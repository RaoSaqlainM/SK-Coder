import { useState, useRef, useEffect, useCallback } from "react"
import { useIDEStore } from "@/store/ideStore"
import { runWithPiston } from "@/lib/pistonRunner"
import { sendAIMessage, buildSystemPrompt } from "@/lib/aiClient"
import { buildAgentInstruction, extractAgentProposal, type AgentAction } from "@/lib/aiAgent"
import { createTerminalWebSocket, isBackendAvailable, runOnBackend, syncBackendWorkspace } from "@/lib/backendRunner"
import { parseErrors } from "@/components/ide/ErrorPanel"
import type { FileNode, AIChatMessage } from "@/types/ide"

declare global {
  interface Window {
    loadPyodide?: (opts: { indexURL: string }) => Promise<{
      runPythonAsync: (code: string) => Promise<unknown>
      globals: { get: (k: string) => unknown }
    }>
    _pyodide?: Awaited<ReturnType<NonNullable<Window["loadPyodide"]>>>
    puter?: {
      auth: { signIn: () => Promise<void>; isSignedIn: () => boolean }
      ai: {
        chat: (msgs: { role: string; content: string }[] | string, opts?: { model?: string }) => Promise<{ message: { content: Array<{ text: string }> } }>
      }
    }
  }
}

type TermType = "shell" | "python" | "nodejs" | "java" | "ai"

type TermLine = {
  id: string
  type: "input" | "output" | "error" | "info" | "success" | "ai-response" | "ai-thinking"
  content: string
}

type TabDef = {
  id: string
  type: TermType
  label: string
}

type TabState = {
  lines: TermLine[]
  input: string
  history: string[]
  histIdx: number
  cwd: string
  running: boolean
}

type BackendTerminalBridge = { send: (msg: Record<string, unknown>) => void; close: () => void }

function mkLine(type: TermLine["type"], content: string): TermLine {
  return { id: Math.random().toString(36).slice(2), type, content }
}

function initState(type: TermType): TabState {
  const welcomes: Record<TermType, string> = {
    shell: "SK-Shell — ls · cd · cat · run <file> · mkdir · touch · help",
    python: "Python 3 ready.",
    nodejs: "Node.js ready.",
    java: "Java ready.",
    ai: "SK-AI is ready to help with your workspace.",
  }
  return {
    lines: [mkLine("info", welcomes[type])],
    input: "",
    history: [],
    histIdx: -1,
    cwd: "/",
    running: false,
  }
}

function collectPaths(nodes: FileNode[]): string[] {
  const paths: string[] = []
  const walk = (items: FileNode[]) => {
    for (const item of items) {
      paths.push(item.path)
      if (item.children) walk(item.children)
    }
  }
  walk(nodes)
  return paths
}

function collectWorkspaceFiles(nodes: FileNode[]): { path: string; content: string }[] {
  const files: { path: string; content: string }[] = []
  const walk = (items: FileNode[]) => {
    for (const item of items) {
      if (item.type === "file") files.push({ path: item.path, content: item.content || "" })
      if (item.children) walk(item.children)
    }
  }
  walk(nodes)
  return files
}

let pyodideLoading = false
let pyodideReady = false
let _tabCounter = 10

function nextTabId(type: TermType) {
  return `${type}-${++_tabCounter}`
}

async function ensurePyodide(onStatus: (msg: string) => void): Promise<boolean> {
  if (pyodideReady && window._pyodide) return true
  if (pyodideLoading) {
    onStatus("Python loading, please wait...")
    return false
  }
  pyodideLoading = true
  onStatus("Loading Python 3.12... (10–30 seconds on first run)")
  return new Promise((resolve) => {
    const doLoad = (loadFn: typeof window.loadPyodide) => {
      loadFn!({ indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.2/full/" })
        .then((py) => {
          window._pyodide = py
          pyodideReady = true
          pyodideLoading = false
          onStatus("Python 3.12 ready")
          resolve(true)
        })
        .catch(() => { pyodideLoading = false; resolve(false) })
    }
    if (window.loadPyodide) { doLoad(window.loadPyodide); return }
    const script = document.createElement("script")
    script.src = "https://cdn.jsdelivr.net/pyodide/v0.26.2/full/pyodide.js"
    script.onload = () => doLoad(window.loadPyodide)
    script.onerror = () => { pyodideLoading = false; resolve(false) }
    document.head.appendChild(script)
  })
}

async function runPythonCode(code: string): Promise<{ output: string; error: string }> {
  try {
    const py = window._pyodide!
    const wrapped = `
import sys, io
_buf = io.StringIO()
sys.stdout = _buf
sys.stderr = _buf
try:
${code.split("\n").map((l) => "    " + l).join("\n")}
except Exception as e:
    print(f"Error: {e}")
finally:
    sys.stdout = sys.__stdout__
    sys.stderr = sys.__stderr__
_buf.getvalue()
`
    const result = await py.runPythonAsync(wrapped)
    return { output: String(result || ""), error: "" }
  } catch (e) {
    return { output: "", error: String(e) }
  }
}

function findNodeAtPath(tree: FileNode[], path: string): FileNode | null {
  for (const n of tree) {
    if (n.path === path) return n
    if (n.children) {
      const found = findNodeAtPath(n.children, path)
      if (found) return found
    }
  }
  return null
}

function getChildrenAt(tree: FileNode[], path: string): FileNode[] {
  if (path === "/" || path === "") return tree
  const node = findNodeAtPath(tree, path)
  return node?.children || []
}

function resolvePath(cwd: string, input: string): string {
  if (!input || input === "~") return "/"
  if (input.startsWith("/")) return input.replace(/\/$/, "") || "/"
  const parts = cwd === "/" ? [] : cwd.split("/").filter(Boolean)
  for (const seg of input.split("/")) {
    if (seg === "..") parts.pop()
    else if (seg !== ".") parts.push(seg)
  }
  return parts.length ? "/" + parts.join("/") : "/"
}

function wrapJavaCode(code: string): string {
  const t = code.trim()
  if ((t.includes("class ") && t.includes("public static void main")) || t.startsWith("public class") || t.startsWith("class")) return t.replace(/public\s+class\s+/, "class ")
  return `class Main {\n    public static void main(String[] args) throws Exception {\n        ${t.endsWith(";") ? t : t + ";"}\n    }\n}`
}

const TERM_COLORS: Record<TermType, string> = {
  shell: "#4eaa25",
  python: "#3572a5",
  nodejs: "#68a063",
  java: "#b07219",
  ai: "#a78bfa",
}

const TERM_LABELS: Record<TermType, string> = {
  shell: "SK-Shell",
  python: "Python 3",
  nodejs: "Node.js",
  java: "Java",
  ai: "SK-AI",
}

const ADD_OPTIONS: { type: TermType; label: string; desc: string }[] = [
  { type: "shell", label: "SK-Shell", desc: "IDE filesystem · run any file via backend" },
  { type: "python", label: "Python 3", desc: "Backend execution · Pyodide offline fallback" },
  { type: "nodejs", label: "Node.js", desc: "Real Node.js via backend · in-browser fallback" },
  { type: "java", label: "Java", desc: "Run Java files and snippets" },
  { type: "ai", label: "SK-AI", desc: "Ask code questions · Puter free AI or API key" },
]

function TermIcon({ type }: { type: TermType }) {
  if (type === "shell") return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>
    </svg>
  )
  if (type === "python") return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2C8 2 6 4 6 7v2h6v1H5C3 10 2 11 2 13s1 3 3 4h2v2c0 2 2 3 5 3s5-1 5-3v-2h6c2 0 3-1 3-3s-1-3-3-4h-1V7C22 4 20 2 16 2h-4z"/>
    </svg>
  )
  if (type === "nodejs") return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
    </svg>
  )
  if (type === "ai") return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h2a7 7 0 0 1 7 7H2a7 7 0 0 1 7-7h2V5.73A2 2 0 0 1 10 4a2 2 0 0 1 2-2z"/>
      <rect x="2" y="14" width="20" height="8" rx="2"/>
      <circle cx="8" cy="18" r="1" fill="currentColor" stroke="none"/>
      <circle cx="16" cy="18" r="1" fill="currentColor" stroke="none"/>
    </svg>
  )
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
    </svg>
  )
}

async function ensurePuterForTerm(): Promise<boolean> {
  if (window.puter) return true
  return new Promise((resolve) => {
    const s = document.createElement("script")
    s.src = "https://js.puter.com/v2/"
    s.onload = () => setTimeout(() => resolve(!!window.puter), 400)
    s.onerror = () => resolve(false)
    document.head.appendChild(s)
  })
}

const DEFAULT_TABS: TabDef[] = [
  { id: "shell-1", type: "shell", label: "SK-Shell" },
  { id: "python-1", type: "python", label: "Python 3" },
  { id: "nodejs-1", type: "nodejs", label: "Node.js" },
  { id: "java-1", type: "java", label: "Java" },
  { id: "ai-1", type: "ai", label: "SK-AI" },
]

const DEFAULT_STATES: Record<string, TabState> = {
  "shell-1": initState("shell"),
  "python-1": initState("python"),
  "nodejs-1": initState("nodejs"),
  "java-1": initState("java"),
  "ai-1": initState("ai"),
}

export default function MultiTerminal() {
  const { fileTree, addFile, updateFileContent, deleteNode, getFileContent, settings, getActiveFile, setShowSettings, setSettingsTab, setActivePanel, refreshPreview, terminalBridgeCmd, setTerminalBridgeCmd, setErrors } = useIDEStore()

  const [tabs, setTabs] = useState<TabDef[]>(DEFAULT_TABS)
  const [activeTab, setActiveTab] = useState("shell-1")
  const [tabStates, setTabStates] = useState<Record<string, TabState>>(DEFAULT_STATES)
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [pyReady, setPyReady] = useState(pyodideReady)
  const [aiReady, setAiReady] = useState(false)
  const [aiProposals, setAiProposals] = useState<Record<string, AgentAction[]>>({})
  const addMenuRef = useRef<HTMLDivElement>(null)

  const outputRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const backendTerminalRef = useRef<BackendTerminalBridge | null>(null)
  const backendSessionRef = useRef("")
  const backendTabRef = useRef("shell-1")

  const activeState = tabStates[activeTab] ?? initState("shell")
  const activeType = tabs.find((t) => t.id === activeTab)?.type ?? "shell"

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [tabStates, activeTab])

  useEffect(() => {
    inputRef.current?.focus()
  }, [activeTab])

  useEffect(() => {
    let disposed = false
    backendTerminalRef.current?.close()
    backendTerminalRef.current = null
    backendSessionRef.current = ""
    if (!settings.backend.enabled) return undefined
    void isBackendAvailable(settings.backend.url, true).then((available) => {
      if (!available || disposed) return
      backendTerminalRef.current = createTerminalWebSocket(
        (_cwd, sessionId) => {
          if (!sessionId) return
          backendSessionRef.current = sessionId
          addLine("shell-1", "success", "Connected to isolated workspace.")
        },
        (data) => addLines(backendTabRef.current, "output", data),
        (data) => addLines(backendTabRef.current, "error", data),
        (code) => addLine(backendTabRef.current, code === 0 ? "success" : "error", `Exit ${code}`),
        (error) => addLine(backendTabRef.current, "error", error),
        settings.backend.url,
      )
    })
    return () => {
      disposed = true
      backendTerminalRef.current?.close()
      backendTerminalRef.current = null
      backendSessionRef.current = ""
    }
  }, [settings.backend.enabled, settings.backend.url])

  useEffect(() => {
    if (!pyodideReady && !pyodideLoading) {
      ensurePyodide((msg) => {
        addLine("python-1", "info", msg)
        if (msg.includes("ready")) setPyReady(true)
      }).then((ok) => { if (ok) setPyReady(true) })
    }
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setShowAddMenu(false)
      }
    }
    if (showAddMenu) {
      document.addEventListener("mousedown", handleClick)
      return () => document.removeEventListener("mousedown", handleClick)
    }
    return undefined
  }, [showAddMenu])

  useEffect(() => {
    if (!terminalBridgeCmd) return
    const bridgeType: TermType = terminalBridgeCmd.targetTab === "python"
      ? "python"
      : terminalBridgeCmd.targetTab === "nodejs"
      ? "nodejs"
      : terminalBridgeCmd.targetTab === "java"
      ? "java"
      : terminalBridgeCmd.targetTab === "ai"
      ? "ai"
      : "shell"
    const targetTab = tabs.find((t) => t.type === bridgeType)
    const tabId = targetTab?.id ?? activeTab
    setActiveTab(tabId)
    const cmd = terminalBridgeCmd.cmd
    const cwd = terminalBridgeCmd.cwd
    setTerminalBridgeCmd(null)
    setTimeout(() => {
      if (cwd) {
        updateState(tabId, { cwd })
        addLine(tabId, "info", `Changed directory to ${cwd}`)
      }
      if (!cmd) return
      addLine(tabId, "input", `$ ${cmd}`)
      if (bridgeType === "shell") handleShell(tabId, cmd).catch(() => {})
      else if (bridgeType === "python") handlePython(tabId, cmd).catch(() => {})
      else if (bridgeType === "nodejs") handleNodeJs(tabId, cmd).catch(() => {})
      else if (bridgeType === "java") handleJava(tabId, cmd).catch(() => {})
      else handleAI(tabId, cmd).catch(() => {})
    }, 50)
  }, [terminalBridgeCmd])

  function updateState(tabId: string, patch: Partial<TabState>) {
    setTabStates((prev) => ({ ...prev, [tabId]: { ...(prev[tabId] ?? initState("shell")), ...patch } }))
  }

  function addLine(tabId: string, type: TermLine["type"], content: string) {
    setTabStates((prev) => {
      const cur = prev[tabId] ?? initState("shell")
      return { ...prev, [tabId]: { ...cur, lines: [...cur.lines.slice(-600), mkLine(type, content)] } }
    })
  }

  function addLines(tabId: string, type: TermLine["type"], text: string) {
    const parts = text.split("\n").filter((l) => l !== "")
    for (const p of parts) addLine(tabId, type, p)
  }

  function clearTab(tabId: string) {
    updateState(tabId, { lines: [] })
  }

  function addNewTab(type: TermType) {
    const id = nextTabId(type)
    const label = TERM_LABELS[type]
    setTabs((prev) => [...prev, { id, type, label }])
    setTabStates((prev) => ({ ...prev, [id]: initState(type) }))
    setActiveTab(id)
    setShowAddMenu(false)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  function closeTab(tabId: string) {
    if (tabs.length === 1) return
    const idx = tabs.findIndex((t) => t.id === tabId)
    const newTabs = tabs.filter((t) => t.id !== tabId)
    setTabs(newTabs)
    if (activeTab === tabId) {
      setActiveTab(newTabs[Math.max(0, idx - 1)].id)
    }
    setTabStates((prev) => {
      const next = { ...prev }
      delete next[tabId]
      return next
    })
  }

  async function handleShell(tabId: string, input: string) {
    const state = tabStates[tabId]
    const cwd = state?.cwd || "/"
    const parts = input.trim().split(/\s+/)
    const cmd = parts[0].toLowerCase()
    const args = parts.slice(1)

    if (settings.backend.enabled && backendTerminalRef.current && backendSessionRef.current) {
      try {
        backendTabRef.current = tabId
        await syncBackendWorkspace(backendSessionRef.current, collectWorkspaceFiles(fileTree), settings.backend.url)
        backendTerminalRef.current.send({ type: "command", command: input })
        return
      } catch (error) {
        addLine(tabId, "error", `Workspace sync failed: ${error instanceof Error ? error.message : "unknown error"}`)
      }
    }

    if (cmd === "help") {
      const help = [
        "SK-Shell commands:",
        "  ls [path]        — list files and directories",
        "  cd <path>        — change directory (cd .. to go up)",
        "  pwd              — print working directory",
        "  cat <file>       — show file content",
        "  echo <text>      — print text",
        "  run <file>       — execute file (auto-detects language)",
        "  python <file>    — run with Python 3",
        "  node <file>      — run with Node.js",
        "  java <file>      — run with Java",
        "  mkdir <name>     — create folder",
        "  touch <name>     — create empty file",
        "  clear / cls      — clear terminal",
        "  help             — show this help",
        "",
        "Tips:",
        "  • Tab key        — autocomplete file/folder names",
        "  • ↑↓ keys        — navigate command history",
        "  • Ctrl+C         — cancel current operation",
        "  • Ctrl+L         — clear screen",
        "  • Right-click any file → Open in Terminal",
      ]
      for (const l of help) addLine(tabId, "info", l)
      return
    }

    if (cmd === "pwd") { addLine(tabId, "output", cwd); return }

    if (cmd === "ls") {
      const path = args[0] ? resolvePath(cwd, args[0]) : cwd
      const children = getChildrenAt(fileTree, path)
      if (children.length === 0) {
        addLine(tabId, "info", "(empty directory)")
      } else {
        const dirs = children.filter((c) => c.type === "folder").map((c) => c.name + "/")
        const fils = children.filter((c) => c.type === "file").map((c) => c.name)
        if (dirs.length) addLine(tabId, "output", dirs.join("  "))
        if (fils.length) addLine(tabId, "output", fils.join("  "))
      }
      return
    }

    if (cmd === "cd") {
      const target = resolvePath(cwd, args[0] || "/")
      if (target === "/") { updateState(tabId, { cwd: "/" }); return }
      const node = findNodeAtPath(fileTree, target)
      if (!node || node.type !== "folder") { addLine(tabId, "error", `cd: ${args[0]}: No such directory`); return }
      updateState(tabId, { cwd: target })
      return
    }

    if (cmd === "cat") {
      if (!args[0]) { addLine(tabId, "error", "cat: missing file operand"); return }
      const path = resolvePath(cwd, args[0])
      const node = findNodeAtPath(fileTree, path)
      if (!node || node.type === "folder") { addLine(tabId, "error", `cat: ${args[0]}: No such file`); return }
      addLines(tabId, "output", node.content || "(empty file)")
      return
    }

    if (cmd === "echo") { addLine(tabId, "output", args.join(" ")); return }

    if (cmd === "mkdir") {
      if (!args[0]) { addLine(tabId, "error", "mkdir: missing operand"); return }
      addFile(cwd, args[0].replace(/[/\\]/g, ""), "folder")
      addLine(tabId, "success", `Created folder: ${args[0]}`)
      return
    }

    if (cmd === "touch") {
      if (!args[0]) { addLine(tabId, "error", "touch: missing operand"); return }
      addFile(cwd, args[0], "file", "")
      addLine(tabId, "success", `Created file: ${args[0]}`)
      return
    }

    if (cmd === "run" || cmd === "python" || cmd === "node" || cmd === "java") {
      const filename = args[0]
      if (!filename) { addLine(tabId, "error", `${cmd}: specify a filename`); return }
      const path = resolvePath(cwd, filename)
      const node = findNodeAtPath(fileTree, path)
      if (!node || node.type === "folder") { addLine(tabId, "error", `${cmd}: ${filename}: No such file`); return }
      const code = node.content || ""
      const ext = filename.split(".").pop()?.toLowerCase() || ""
      updateState(tabId, { running: true })
      addLine(tabId, "info", `Running ${filename}...`)
      const backOk = await isBackendAvailable(settings.backend.url, settings.backend.enabled)

      if (cmd === "python" || (cmd === "run" && ext === "py")) {
        if (backOk) {
          const res = await runOnBackend("python", code, { endpoint: settings.backend.url })
          if (!res.error) {
            if (res.stdout) addLines(tabId, "output", res.stdout.trimEnd())
            if (res.stderr) { addLines(tabId, "error", res.stderr.trimEnd()); const errs = parseErrors(res.stderr); if (errs.length) setErrors(errs) }
            if (!res.stdout && !res.stderr) addLine(tabId, "info", "(no output)")
            addLine(tabId, "info", `⏱ ${res.executionTime}ms | exit ${res.exitCode}`)
            updateState(tabId, { running: false }); return
          }
        }
        const publicRes = await runWithPiston(code, "python", settings.piston.serverUrl)
        if (!publicRes.unavailable) {
          if (publicRes.output) addLines(tabId, "output", publicRes.output.trimEnd())
          if (publicRes.stderr) addLines(tabId, "error", publicRes.stderr.trimEnd())
          if (!publicRes.output && !publicRes.stderr) addLine(tabId, "info", "(no output)")
          addLine(tabId, publicRes.exitCode === 0 ? "success" : "error", `Exit ${publicRes.exitCode}`)
          updateState(tabId, { running: false }); return
        }
        const ready = await ensurePyodide((msg) => { addLine(tabId, "info", msg); if (msg.includes("ready")) setPyReady(true) })
        if (!ready) { addLine(tabId, "error", "Python not ready yet"); updateState(tabId, { running: false }); return }
        const { output, error } = await runPythonCode(code)
        if (output) addLines(tabId, "output", output.trimEnd())
        if (error) addLine(tabId, "error", error)
        if (!output && !error) addLine(tabId, "info", "(no output)")
      } else if (cmd === "node" || (cmd === "run" && ["js", "jsx", "ts", "tsx", "mjs", "cjs"].includes(ext))) {
        if (backOk) {
          const res = await runOnBackend("node", code, { endpoint: settings.backend.url })
          if (!res.error) {
            if (res.stdout) addLines(tabId, "output", res.stdout.trimEnd())
            if (res.stderr) addLines(tabId, "error", res.stderr.trimEnd())
            if (!res.stdout && !res.stderr) addLine(tabId, "info", "(no output)")
            addLine(tabId, "info", `⏱ ${res.executionTime}ms | exit ${res.exitCode}`)
            updateState(tabId, { running: false }); return
          }
        }
        const publicRes = await runWithPiston(code, ext === "ts" || ext === "tsx" ? "typescript" : "javascript", settings.piston.serverUrl)
        if (!publicRes.unavailable) {
          if (publicRes.output) addLines(tabId, "output", publicRes.output.trimEnd())
          if (publicRes.stderr) addLines(tabId, "error", publicRes.stderr.trimEnd())
          if (!publicRes.output && !publicRes.stderr) addLine(tabId, "info", "(no output)")
          addLine(tabId, publicRes.exitCode === 0 ? "success" : "error", `Exit ${publicRes.exitCode}`)
        } else {
          addLine(tabId, "error", "No real Node.js runtime is reachable. Reconnect the server workspace or try again shortly.")
        }
      } else if (cmd === "java" || (cmd === "run" && ext === "java")) {
        const javaCode = wrapJavaCode(code)
        if (backOk) {
          const res = await runOnBackend("java", javaCode, { endpoint: settings.backend.url })
          if (!res.error) {
            if (res.stdout) addLines(tabId, "output", res.stdout.trimEnd())
            if (res.stderr) { addLines(tabId, "error", res.stderr.trimEnd()); const errs = parseErrors(res.stderr); if (errs.length) setErrors(errs) }
            if (!res.stdout && !res.stderr) addLine(tabId, "info", "(no output)")
            addLine(tabId, "info", `⏱ ${res.executionTime}ms | exit ${res.exitCode}`)
            updateState(tabId, { running: false }); return
          }
        }
        const res = await runWithPiston(javaCode, "java")
        if (res.output) addLines(tabId, "output", res.output.trimEnd())
        if (res.stderr) addLines(tabId, "error", res.stderr.trimEnd())
        if (!res.output && !res.stderr) addLine(tabId, "info", "(no output)")
      } else if (cmd === "run") {
        const langMap: Record<string, string> = { cpp: "cpp", c: "c", rs: "rust", go: "go", rb: "ruby", php: "php", sh: "bash", kt: "kotlin" }
        const lang = langMap[ext] || ""
        if (!lang) { addLine(tabId, "error", `Cannot run .${ext} files — use a language-specific terminal`); updateState(tabId, { running: false }); return }
        if (backOk) {
          const res = await runOnBackend(lang, code, { endpoint: settings.backend.url })
          if (!res.error) {
            if (res.stdout) addLines(tabId, "output", res.stdout.trimEnd())
            if (res.stderr) { addLines(tabId, "error", res.stderr.trimEnd()); const errs = parseErrors(res.stderr); if (errs.length) setErrors(errs) }
            if (!res.stdout && !res.stderr) addLine(tabId, "info", "(no output)")
            addLine(tabId, "info", `⏱ ${res.executionTime}ms | exit ${res.exitCode}`)
            updateState(tabId, { running: false }); return
          }
        }
        const res = await runWithPiston(code, lang)
        if (res.output) addLines(tabId, "output", res.output.trimEnd())
        if (res.stderr) addLines(tabId, "error", res.stderr.trimEnd())
        if (!res.output && !res.stderr) addLine(tabId, "info", "(no output)")
      }
      updateState(tabId, { running: false })
      return
    }

    addLine(tabId, "error", `${cmd}: command not found. Type 'help' for available commands.`)
  }

  async function handlePython(tabId: string, code: string) {
    const state = tabStates[tabId]
    const cwd = state?.cwd || "/"
    const trimmed = code.trim()
    const runMatch = trimmed.match(/^(?:run|python)\s+(\S+)$/)
    let execCode = trimmed
    if (runMatch) {
      const filename = runMatch[1]
      const path = resolvePath(cwd, filename)
      const node = findNodeAtPath(fileTree, path)
      if (!node || node.type === "folder") {
        addLine(tabId, "error", `run: ${filename}: No such file`)
        return
      }
      addLine(tabId, "info", `Running ${filename}...`)
      execCode = node.content || ""
    }
    const backOk = await isBackendAvailable(settings.backend.url, settings.backend.enabled)
    if (backOk) {
      const res = await runOnBackend("python", execCode, { endpoint: settings.backend.url })
      if (!res.error) {
        if (res.stdout) addLines(tabId, "output", res.stdout.trimEnd())
        if (res.stderr) { addLines(tabId, "error", res.stderr.trimEnd()); const errs = parseErrors(res.stderr); if (errs.length) setErrors(errs) }
        if (!res.stdout && !res.stderr) addLine(tabId, "info", "(no output)")
        addLine(tabId, "info", `⏱ ${res.executionTime}ms | exit ${res.exitCode}`)
        return
      }
    }
    const publicRes = await runWithPiston(execCode, "python", settings.piston.serverUrl)
    if (!publicRes.unavailable) {
      if (publicRes.output) addLines(tabId, "output", publicRes.output.trimEnd())
      if (publicRes.stderr) addLines(tabId, "error", publicRes.stderr.trimEnd())
      if (!publicRes.output && !publicRes.stderr) addLine(tabId, "info", "(no output)")
      addLine(tabId, publicRes.exitCode === 0 ? "success" : "error", `Exit ${publicRes.exitCode}`)
      return
    }
    const ready = await ensurePyodide((msg) => { addLine(tabId, "info", msg); if (msg.includes("ready")) setPyReady(true) })
    if (!ready) { addLine(tabId, "error", "Python not ready — please wait"); return }
    const { output, error } = await runPythonCode(execCode)
    if (output) addLines(tabId, "output", output.trimEnd())
    if (error) addLine(tabId, "error", error)
    if (!output && !error) addLine(tabId, "info", "(no output)")
  }

  async function handleNodeJs(tabId: string, code: string) {
    const state = tabStates[tabId]
    const cwd = state?.cwd || "/"
    const trimmed = code.trim()
    const runMatch = trimmed.match(/^(?:run|node)\s+(\S+)/)
    let execCode = trimmed
    if (runMatch) {
      const filename = runMatch[1]
      const path = resolvePath(cwd, filename)
      const node = findNodeAtPath(fileTree, path)
      if (!node || node.type === "folder") { addLine(tabId, "error", `run: ${filename}: No such file`); return }
      addLine(tabId, "info", `Running ${filename}...`)
      execCode = node.content || ""
    }
    const backOk = await isBackendAvailable(settings.backend.url, settings.backend.enabled)
    if (backOk) {
      const res = await runOnBackend("node", execCode, { endpoint: settings.backend.url })
      if (!res.error) {
        if (res.stdout) addLines(tabId, "output", res.stdout.trimEnd())
        if (res.stderr) addLines(tabId, "error", res.stderr.trimEnd())
        if (!res.stdout && !res.stderr) addLine(tabId, "info", "(no output)")
        addLine(tabId, "info", `⏱ ${res.executionTime}ms | exit ${res.exitCode}`)
        return
      }
    }
    const publicRes = await runWithPiston(execCode, "javascript", settings.piston.serverUrl)
    if (!publicRes.unavailable) {
      if (publicRes.output) addLines(tabId, "output", publicRes.output.trimEnd())
      if (publicRes.stderr) addLines(tabId, "error", publicRes.stderr.trimEnd())
      if (!publicRes.output && !publicRes.stderr) addLine(tabId, "info", "(no output)")
      addLine(tabId, publicRes.exitCode === 0 ? "success" : "error", `Exit ${publicRes.exitCode}`)
    } else {
      addLine(tabId, "error", "No real Node.js runtime is reachable. Reconnect the server workspace or try again shortly.")
    }
  }

  async function handleJava(tabId: string, code: string) {
    const state = tabStates[tabId]
    const cwd = state?.cwd || "/"
    const trimmed = code.trim()
    const runMatch = trimmed.match(/^(?:run|java)\s+(\S+)/)
    let javaCode = trimmed
    if (runMatch) {
      const filename = runMatch[1]
      const path = resolvePath(cwd, filename)
      const node = findNodeAtPath(fileTree, path)
      if (!node || node.type === "folder") { addLine(tabId, "error", `run: ${filename}: No such file`); return }
      addLine(tabId, "info", `Running ${filename}...`)
      javaCode = node.content || ""
    }
    javaCode = wrapJavaCode(javaCode)
    const backOk = await isBackendAvailable(settings.backend.url, settings.backend.enabled)
    if (backOk) {
      const res = await runOnBackend("java", javaCode, { endpoint: settings.backend.url })
      if (!res.error) {
        if (res.stdout) addLines(tabId, "output", res.stdout.trimEnd())
        if (res.stderr) { addLines(tabId, "error", res.stderr.trimEnd()); const errs = parseErrors(res.stderr); if (errs.length) setErrors(errs) }
        if (!res.stdout && !res.stderr) addLine(tabId, "info", "(no output)")
        addLine(tabId, "info", `⏱ ${res.executionTime}ms | exit ${res.exitCode}`)
        return
      }
    }
    const res = await runWithPiston(javaCode, "java")
    if (res.output) addLines(tabId, "output", res.output.trimEnd())
    if (res.stderr) addLines(tabId, "error", res.stderr.trimEnd())
    if (!res.output && !res.stderr) addLine(tabId, "info", "(no output)")
  }

  async function handleAI(tabId: string, question: string) {
    const { apiKey, usePuter, keyStatus, autoContext } = settings.ai
    const hasKey = usePuter || (apiKey && keyStatus === "valid")
    if (!hasKey) {
      addLine(tabId, "error", "No AI configured — go to Settings → SK-AI to add a key or enable Free Puter AI")
      setSettingsTab("ai")
      setShowSettings(true)
      return
    }
    const thinkingId = Math.random().toString(36).slice(2)
    setTabStates((prev) => {
      const cur = prev[tabId] ?? initState("ai")
      return { ...prev, [tabId]: { ...cur, lines: [...cur.lines, { id: thinkingId, type: "ai-thinking" as const, content: "Thinking..." }] } }
    })
    const activeFile = getActiveFile()
    const systemPrompt = `${buildSystemPrompt({ activeFilePath: activeFile?.path, activeFileContent: autoContext ? activeFile?.content : undefined, fileTree: collectPaths(fileTree) })}\n\n${buildAgentInstruction()}`
    try {
      let reply = ""
      if (usePuter) {
        const ok = await ensurePuterForTerm()
        if (!ok) { reply = "Puter.js failed to load. Check your internet." }
        else {
          if (!window.puter!.auth.isSignedIn()) await window.puter!.auth.signIn()
          const resp = await window.puter!.ai.chat(`${systemPrompt}\n\nUser: ${question}`) as unknown
          const raw = resp as { message?: { content?: unknown } }
          const c = raw?.message?.content
          reply = typeof c === "string" ? c : Array.isArray(c) ? ((c[0] as { text?: string })?.text ?? String(c[0] ?? "")) : typeof resp === "string" ? (resp as string) : String(c ?? "")
          if (!reply.trim()) reply = "SK-AI returned an empty response. Try rephrasing."
          setAiReady(true)
        }
      } else {
        const messages: AIChatMessage[] = [{ id: "q", role: "user", content: question, timestamp: Date.now() }]
        const res = await sendAIMessage({ key: apiKey, customEndpoint: settings.ai.apiEndpoint, customModel: settings.ai.model, messages, systemPrompt })
        if (res.error) reply = `Error: ${res.error}`
        else reply = res.content || "(no response)"
      }
      const proposal = extractAgentProposal(reply)
      if (proposal.actions.length) {
        setAiProposals((current) => ({ ...current, [tabId]: [...(current[tabId] || []), ...proposal.actions] }))
      }
      setTabStates((prev) => {
        const cur = prev[tabId] ?? initState("ai")
        const withoutThinking = cur.lines.filter((l) => l.id !== thinkingId)
        const replyLines = (proposal.message || "I prepared actions for your review.").split("\n").map((line) => mkLine("ai-response", line))
        return { ...prev, [tabId]: { ...cur, lines: [...withoutThinking, ...replyLines, mkLine("info", "─────")] } }
      })
    } catch (e) {
      setTabStates((prev) => {
        const cur = prev[tabId] ?? initState("ai")
        const withoutThinking = cur.lines.filter((l) => l.id !== thinkingId)
        return { ...prev, [tabId]: { ...cur, lines: [...withoutThinking, mkLine("error", `AI Error: ${String(e)}`)] } }
      })
    }
  }

  function removeAIProposal(tabId: string, proposalId: string) {
    setAiProposals((current) => ({ ...current, [tabId]: (current[tabId] || []).filter((proposal) => proposal.id !== proposalId) }))
  }

  function approveAIProposal(tabId: string, action: AgentAction) {
    if (action.type === "write") {
      if (getFileContent(action.path) === undefined) {
        const index = action.path.lastIndexOf("/")
        addFile(index <= 0 ? "" : action.path.slice(0, index), action.path.slice(index + 1), "file", action.content)
      } else {
        updateFileContent(action.path, action.content)
      }
    }
    if (action.type === "create_folder") {
      const index = action.path.lastIndexOf("/")
      addFile(index <= 0 ? "" : action.path.slice(0, index), action.path.slice(index + 1), "folder")
    }
    if (action.type === "delete") deleteNode(action.path)
    if (action.type === "run") setTerminalBridgeCmd({ cmd: action.command, targetTab: action.terminal })
    if (action.type === "preview") {
      refreshPreview()
      setActivePanel("preview")
    }
    removeAIProposal(tabId, action.id)
  }

  async function handleSubmit(tabId: string) {
    const state = tabStates[tabId]
    const input = state?.input?.trim()
    if (!input || state?.running) return
    const type = tabs.find((t) => t.id === tabId)?.type || "shell"
    const newHistory = [input, ...(state.history || []).slice(0, 99)]
    updateState(tabId, { input: "", history: newHistory, histIdx: -1 })
    const prompts: Record<TermType, string> = { shell: `[${state.cwd || "/"}]$`, python: ">>>", nodejs: ">", java: "java>", ai: "you>" }
    addLine(tabId, "input", `${prompts[type]} ${input}`)
    if (input === "clear" || input === "cls") { updateState(tabId, { lines: [] }); return }
    updateState(tabId, { running: true })
    try {
      if (type === "shell") await handleShell(tabId, input)
      else if (type === "python") await handlePython(tabId, input)
      else if (type === "nodejs") await handleNodeJs(tabId, input)
      else if (type === "java") await handleJava(tabId, input)
      else if (type === "ai") await handleAI(tabId, input)
    } finally {
      setTabStates((prev) => prev[tabId] ? { ...prev, [tabId]: { ...prev[tabId], running: false } } : prev)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>, tabId: string) {
    const state = tabStates[tabId]
    if (e.key === "Enter") { handleSubmit(tabId); return }
    if (e.key === "ArrowUp") {
      e.preventDefault()
      const next = Math.min((state?.histIdx ?? -1) + 1, (state?.history?.length ?? 0) - 1)
      updateState(tabId, { histIdx: next, input: state?.history?.[next] || "" })
      return
    }
    if (e.key === "ArrowDown") {
      e.preventDefault()
      const next = Math.max((state?.histIdx ?? -1) - 1, -1)
      updateState(tabId, { histIdx: next, input: next === -1 ? "" : state?.history?.[next] || "" })
      return
    }
    if (e.key === "c" && e.ctrlKey) { addLine(tabId, "info", "^C"); updateState(tabId, { input: "", running: false }) }
    if (e.key === "l" && e.ctrlKey) { e.preventDefault(); updateState(tabId, { lines: [] }) }
    if (e.key === "Tab") {
      e.preventDefault()
      const input = state?.input || ""
      const cwd = state?.cwd || "/"
      const children = getChildrenAt(fileTree, cwd)
      const lastWord = input.split(" ").pop() || ""
      const match = children.find((c) => c.name.startsWith(lastWord))
      if (match) {
        const words = input.split(" ")
        words[words.length - 1] = match.type === "folder" ? match.name + "/" : match.name
        updateState(tabId, { input: words.join(" ") })
      }
    }
  }

  const promptLabels: Record<TermType, string> = {
    shell: `${activeState.cwd || "/"}$`,
    python: ">>>",
    nodejs: ">",
    java: "java>",
    ai: "ask>",
  }

  const placeholders: Record<TermType, string> = {
    shell: "ls · cd <dir> · run <file> · mkdir · help  (↑↓ history, Tab complete)",
    python: "print('hello')  • import math  • any Python 3 code",
    nodejs: "console.log('hello')  • require('fs')  • full Node.js",
    java: "System.out.println(\"hello\");  • or paste full class",
    ai: "Ask a coding question, explain an error, generate code...",
  }

  return (
    <div className="multi-terminal">
      <div className="multi-terminal-tabs">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab
          const isReady = tab.type === "python" ? pyReady : tab.type === "shell"
          const isAiReady = tab.type === "ai" && (aiReady || !!(settings.ai.usePuter || settings.ai.apiKey))
          return (
            <div
              key={tab.id}
              className={`multi-term-tab ${isActive ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span style={{ color: TERM_COLORS[tab.type], display: "flex", alignItems: "center" }}>
                <TermIcon type={tab.type} />
              </span>
              <span>{tab.label}</span>
              {(isReady || tab.type === "nodejs" || tab.type === "java" || isAiReady) && (
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: tab.type === "ai" ? "#a78bfa" : "var(--green)", flexShrink: 0 }} />
              )}
            </div>
          )
        })}

        <div ref={addMenuRef} style={{ position: "relative", flexShrink: 0 }}>
          <button
            className="term-add-btn"
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setShowAddMenu((v) => !v) }}
            title="Add new terminal"
          >+</button>
          {showAddMenu && (
            <div
              className="term-add-menu"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="term-add-menu-title">New Terminal</div>
              {ADD_OPTIONS.map((opt) => (
                <button
                  key={opt.type}
                  className="term-add-option"
                  onMouseDown={(e) => { e.preventDefault(); addNewTab(opt.type) }}
                >
                  <span style={{ color: TERM_COLORS[opt.type] }}><TermIcon type={opt.type} /></span>
                  <div>
                    <div style={{ fontWeight: 600 }}>{opt.label}</div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 1 }}>{opt.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", paddingRight: 4, gap: 2 }}>
          <button className="btn-icon" onClick={() => clearTab(activeTab)} title="Clear terminal">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            </svg>
          </button>
        </div>
      </div>

      <div className="terminal-output" ref={outputRef} onClick={() => inputRef.current?.focus()}>
        {activeState.lines.map((line) => {
          if (line.type === "ai-thinking") {
            return (
              <div key={line.id} className="terminal-line info" style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#a78bfa", opacity: 0.8 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: "spin 1s linear infinite", flexShrink: 0 }}>
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                <span style={{ fontStyle: "italic" }}>{line.content}</span>
              </div>
            )
          }
          if (line.type === "ai-response") {
            const isCode = line.content.startsWith("```") || line.content.startsWith("    ")
            if (line.content === "─────") return <div key={line.id} style={{ borderTop: "1px solid rgba(167,139,250,0.2)", margin: "0.4rem 0" }} />
            return (
              <div key={line.id} style={{
                fontFamily: isCode ? "var(--font-mono)" : "inherit",
                fontSize: isCode ? 11 : 12,
                color: isCode ? "#e2c08d" : "var(--text-primary)",
                background: isCode ? "rgba(167,139,250,0.06)" : "transparent",
                borderLeft: isCode ? "2px solid #a78bfa" : "none",
                paddingLeft: isCode ? "0.5rem" : 0,
                lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word",
              }}>{line.content}</div>
            )
          }
          return (
            <div key={line.id} className={`terminal-line ${line.type}`}>
              <span>{line.content}</span>
            </div>
          )
        })}
        {activeType === "ai" && (aiProposals[activeTab] || []).map((action) => (
          <div key={action.id} style={{ border: "1px solid rgba(167,139,250,0.45)", borderRadius: 6, padding: "0.45rem", margin: "0.45rem 0", background: "rgba(167,139,250,0.06)" }}>
            <div style={{ color: "var(--text-primary)", fontSize: 12, fontWeight: 600, marginBottom: "0.4rem" }}>{action.label}</div>
            <div style={{ display: "flex", gap: "0.35rem" }}>
              <button className="btn btn-primary" style={{ padding: "0.2rem 0.45rem", fontSize: 10 }} onClick={() => approveAIProposal(activeTab, action)}>Approve</button>
              <button className="btn btn-ghost" style={{ padding: "0.2rem 0.45rem", fontSize: 10 }} onClick={() => removeAIProposal(activeTab, action.id)}>Decline</button>
            </div>
          </div>
        ))}
        {activeState.running && activeType !== "ai" && (
          <div className="terminal-line info" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: "spin 1s linear infinite", flexShrink: 0 }}>
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
            <span>Running...</span>
          </div>
        )}
      </div>

      <div className="terminal-input-row">
        <span className="terminal-prompt-label" style={{ color: TERM_COLORS[activeType], fontSize: 11, whiteSpace: "nowrap", maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis" }}>
          {promptLabels[activeType]}
        </span>
        <input
          ref={inputRef}
          className="terminal-input"
          value={activeState.input}
          onChange={(e) => updateState(activeTab, { input: e.target.value })}
          onKeyDown={(e) => handleKeyDown(e, activeTab)}
          placeholder={placeholders[activeType]}
          disabled={activeState.running}
          autoComplete="off"
          spellCheck={false}
          style={{ width: "auto", border: "none", padding: 0, background: "transparent" }}
        />
        <button
          className="btn btn-primary"
          style={{ padding: "0.2rem 0.6rem", fontSize: 11, flexShrink: 0 }}
          onClick={() => handleSubmit(activeTab)}
          disabled={activeState.running || !activeState.input.trim()}
        >
          Run
        </button>
      </div>
    </div>
  )
}

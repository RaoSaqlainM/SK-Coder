import { useEffect, useRef, useState, useCallback } from "react";
import { useIDEStore } from "@/store/ideStore";
import { Trash2, Copy, Check, Cloud, RotateCcw, Smartphone, Plus, X, type LucideIcon } from "lucide-react";
import type { TerminalType, FileNode } from "@/types/ide";
import { runPython } from "@/lib/pyodideRunner";
import { runJS } from "@/lib/jsRunner";
import { runViaPiston, type CloudResult } from "@/lib/pistonRunner";
import { buildHtmlPreview, buildReactPreview, findPreviewEntry, htmlToDataUrl } from "@/lib/previewBuilder";
import { runSandboxCommand, runWorkspaceProject } from "@/lib/workspaceSandbox";
import { isAndroid, isTermuxInstalled, runTermuxCommand } from "@/lib/termuxBridge";
import { runViaWandbox, supportsWandbox } from "@/lib/wandboxRunner";
import CloudShell from "@/components/ide/CloudShell";
import TermuxSetup from "@/components/ide/TermuxSetup";
import BackendTerminal from "@/components/ide/BackendTerminal";

type TabKind = "local" | "server" | "cloud" | "termux";

interface TerminalDef {
  id: TerminalType;
  label: string;
  prompt: string;
  cloudExt?: string;
  hint?: string;
}

type AddedTerminal = { id: string; type: TerminalType; label: string };

const TERMINALS: TerminalDef[] = [
  { id: "shell",      label: "Shell",    prompt: "$" },
  { id: "python",     label: "Python",   prompt: ">>>" },
  { id: "node",       label: "Node",     prompt: "node>",                    hint: "Single-file JS runs locally. For npm/dev servers use Cloud Shell or Termux." },
  { id: "bash",       label: "Bash",     prompt: "bash$",  cloudExt: "bash", hint: "Single bash script via cloud. Interactive shell needs Cloud Shell or Termux." },
];

function findFileByName(nodes: FileNode[], name: string): FileNode | null {
  for (const n of nodes) {
    if (n.type === "file" && (n.name === name || n.path === name)) return n;
    if (n.children) {
      const f = findFileByName(n.children, name);
      if (f) return f;
    }
  }
  return null;
}

function extOf(name: string) {
  return name.split(".").pop()?.toLowerCase() || "";
}

function isPackageCommand(command: string) {
  return ["npm", "pnpm", "yarn", "bun", "vite", "next", "react-scripts"].includes(command);
}

function fileFromCommandParts(nodes: FileNode[], parts: string[]) {
  for (const part of parts) {
    const cleaned = part.replace(/^['"]|['"]$/g, "");
    const found = findFileByName(nodes, cleaned);
    if (found) return found;
  }
  return null;
}

function showCloudResult(result: CloudResult, addTerminalLine: ReturnType<typeof useIDEStore.getState>["addTerminalLine"]) {
  if (result.message) addTerminalLine({ text: result.message, type: result.offline ? "info" : "error" });
  if (result.compileStderr) result.compileStderr.split("\n").forEach((l) => l && addTerminalLine({ text: l, type: "error" }));
  if (result.diagnostics?.length) {
    addTerminalLine({ text: "Mapped source lines:", type: "info" });
    result.diagnostics.forEach((d) => addTerminalLine({ text: `${d.filePath}:${d.lineNumber}${d.columnNumber ? `:${d.columnNumber}` : ""}: ${d.message}${d.sourceLine ? ` → ${d.sourceLine}` : ""}`, type: "error", filePath: d.filePath, lineNumber: d.lineNumber, columnNumber: d.columnNumber }));
  }
  if (result.stdout) result.stdout.split("\n").forEach((l) => addTerminalLine({ text: l, type: "output" }));
  if (result.stderr) result.stderr.split("\n").forEach((l) => l && addTerminalLine({ text: l, type: "error" }));
  if (!result.stdout && !result.stderr && !result.compileStderr && !result.message) addTerminalLine({ text: "(no output)", type: "output" });
  addTerminalLine({ text: `exit ${result.code ?? (result.ok ? 0 : 1)}`, type: result.ok ? "success" : "error" });
}

export default function Terminal() {
  const { terminalLines, addTerminalLine, clearTerminal, terminalType, setTerminalType, setPreviewUrl, setActivePanel, openFile, setEditorTarget, terminalBridgeCmd, setTerminalBridgeCmd } = useIDEStore();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [hIdx, setHIdx] = useState(-1);
  const [busy, setBusy] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [lastRun, setLastRun] = useState<{ ext: string; source: string; label: string; filePath?: string } | null>(null);
  const [tabKind, setTabKind] = useState<TabKind>("local");
  const [termuxOk, setTermuxOk] = useState(false);
  const [addedTerminals, setAddedTerminals] = useState<AddedTerminal[]>([]);
  const [activeTerminalKey, setActiveTerminalKey] = useState(`default-${terminalType}`);
  const [cwd, setCwd] = useState("/");

  useEffect(() => { isTermuxInstalled().then(setTermuxOk); }, [tabKind]);

  useEffect(() => {
    if (!addedTerminals.some((tab) => tab.id === activeTerminalKey)) setActiveTerminalKey(`default-${terminalType}`);
  }, [activeTerminalKey, addedTerminals, terminalType]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [terminalLines]);

  const current = TERMINALS.find((t) => t.id === terminalType) || TERMINALS[0];
  const terminalTabs = [
    ...TERMINALS.map((terminal) => ({ key: `default-${terminal.id}`, terminal, closable: false })),
    ...addedTerminals.map((terminal) => ({ key: terminal.id, terminal: { ...TERMINALS.find((item) => item.id === terminal.type)!, label: terminal.label }, closable: true }))
  ];

  const selectTerminal = (key: string, type: TerminalType) => {
    setActiveTerminalKey(key);
    setTerminalType(type);
  };

  const addTerminal = () => {
    const id = `added-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const terminal = { id, type: terminalType, label: `${current.label} ${addedTerminals.length + 2}` };
    setAddedTerminals((tabs) => [...tabs, terminal]);
    setActiveTerminalKey(id);
  };

  const closeAddedTerminal = (id: string) => {
    setAddedTerminals((tabs) => tabs.filter((tab) => tab.id !== id));
    if (activeTerminalKey === id) setActiveTerminalKey(`default-${terminalType}`);
  };

  const runNodeSource = useCallback(async (source: string, filePath?: string) => {
    const result = await runViaWandbox("js", source);
    if (!result.offline) {
      showCloudResult(result, addTerminalLine);
      return;
    }
    addTerminalLine({ text: "Wandbox is unavailable. Running this standalone script in the browser.", type: "info" });
    await runJS(source, (text, type) => addTerminalLine({ text, type: type === "error" ? "error" : "output", filePath }));
    addTerminalLine({ text: "JavaScript completed", type: "success" });
  }, [addTerminalLine]);

  const executeFile = useCallback(async (target: FileNode) => {
    const ext = extOf(target.name);
    const source = target.content || "";
    setLastRun({ ext, source, label: target.path, filePath: target.path });
    if (ext === "html") {
      setPreviewUrl(htmlToDataUrl(buildHtmlPreview(target, useIDEStore.getState().fileTree)));
      setActivePanel("preview");
      addTerminalLine({ text: `Preview ready: ${target.path}`, type: "success" });
      return;
    }
    if (["jsx", "tsx"].includes(ext)) {
      setPreviewUrl(htmlToDataUrl(buildReactPreview(target, useIDEStore.getState().fileTree)));
      setActivePanel("preview");
      addTerminalLine({ text: `React preview ready: ${target.path}`, type: "success" });
      return;
    }
    if (ext === "py") {
      await runPython(source, (s) => addTerminalLine({ text: s, type: "output" }));
      addTerminalLine({ text: "Python completed", type: "success" });
      return;
    }
    if (["js", "mjs", "cjs"].includes(ext)) {
      addTerminalLine({ text: "Running Node.js with Wandbox...", type: "info" });
      await runNodeSource(source, target.path);
      return;
    }
    if (["sh", "bash"].includes(ext)) {
      addTerminalLine({ text: `Running ${target.name} in the Bash cloud fallback...`, type: "info" });
      showCloudResult(await runViaPiston("bash", source, "", target.path), addTerminalLine);
      return;
    }
    addTerminalLine({ text: `The .${ext} runner is planned for Phase 2. Phase 1 supports Python, Node.js, and Bash.`, type: "info" });
  }, [addTerminalLine, runNodeSource, setActivePanel, setPreviewUrl]);

  const retryLast = useCallback(async () => {
    if (!lastRun || busy) return;
    setBusy(true);
    addTerminalLine({ text: `Retry ${lastRun.label}`, type: "input" });
    try {
        if (supportsWandbox(lastRun.ext)) await runNodeSource(lastRun.source, lastRun.filePath);
        else if (lastRun.ext === "bash") showCloudResult(await runViaPiston("bash", lastRun.source, "", lastRun.filePath || lastRun.label), addTerminalLine);
      else addTerminalLine({ text: "Retry is available for the last cloud compile job.", type: "info" });
    } finally {
      setBusy(false);
    }
  }, [addTerminalLine, busy, lastRun, runNodeSource]);

  const handleCommand = useCallback(async (cmd: string) => {
    if (busy) return;
    setHistory((h) => [...h, cmd]);
    setHIdx(-1);
    addTerminalLine({ text: `${current.prompt} ${cmd}`, type: "input" });
    const parts = cmd.trim().split(/\s+/);
    const command = parts[0]?.toLowerCase() || "";

    if (command === "clear" || command === "cls") { clearTerminal(); return; }
    if (command === "help") {
      addTerminalLine({ text: "Commands: clear, ls, cd, pwd, mkdir, rm, cat, cp, mv, echo, grep, find, date, whoami, tree, version, preview, run <file>, termux <cmd>", type: "info" });
      addTerminalLine({ text: "Phase 1 runners: Python, Node.js, and Bash. Workspace commands work in the browser without a server runtime.", type: "info" });
      return;
    }
    if (["ls", "dir", "cd", "pwd", "mkdir", "rm", "cat", "cp", "mv", "echo", "grep", "find", "open"].includes(command)) {
      const result = await runSandboxCommand(command, parts.slice(1), useIDEStore.getState().fileTree, (text, type: "input" | "output" | "error" | "info" | "success" = "output") => addTerminalLine({ text, type }), setPreviewUrl, {
        cwd,
        actions: {
          addFile: useIDEStore.getState().addFile,
          deleteFileNode: useIDEStore.getState().deleteFileNode,
          renameNode: useIDEStore.getState().renameNode,
          moveNode: useIDEStore.getState().moveNode,
          setFileTree: useIDEStore.getState().setFileTree,
        },
      });
      setCwd(result.cwd);
      return;
    }
    if (command === "termux") {
      if (!isAndroid()) { addTerminalLine({ text: "termux: only available in the Android app", type: "error" }); return; }
      if (!termuxOk) { addTerminalLine({ text: "termux: not installed. Open the Termux tab to set it up.", type: "error" }); return; }
      const sub = parts.slice(1);
      if (!sub.length) { addTerminalLine({ text: "Usage: termux <command> [args...]", type: "info" }); return; }
      setBusy(true);
      try {
        const res = await runTermuxCommand(sub[0], sub.slice(1));
        if (res.stdout) res.stdout.split("\n").forEach((l) => l && addTerminalLine({ text: l, type: "output" }));
        if (res.stderr) res.stderr.split("\n").forEach((l) => l && addTerminalLine({ text: l, type: "error" }));
        addTerminalLine({ text: `exit ${res.exitCode}`, type: res.exitCode === 0 ? "success" : "error" });
      } catch (e) {
        addTerminalLine({ text: e instanceof Error ? e.message : String(e), type: "error" });
      } finally { setBusy(false); }
      return;
    }
    if (command === "preview") {
      const tree = useIDEStore.getState().fileTree;
      const entry = findPreviewEntry(tree);
      if (!entry) { addTerminalLine({ text: "preview: no index.html or React entry found", type: "error" }); return; }
      const ext = extOf(entry.name);
      if (ext === "html") setPreviewUrl(htmlToDataUrl(buildHtmlPreview(entry, tree)));
      else setPreviewUrl(htmlToDataUrl(buildReactPreview(entry, tree)));
      setActivePanel("preview");
      addTerminalLine({ text: `Preview ready: ${entry.path}`, type: "success" });
      return;
    }
    if ((command === "run" && !parts[1]) || (command === "npm" && parts[1] === "run" && ["dev", "start"].includes(parts[2] || ""))) {
      const tree = useIDEStore.getState().fileTree;
      if (!findFileByName(tree, "package.json")) { addTerminalLine({ text: "run project: package.json not found", type: "error" }); return; }
      setBusy(true);
      setTerminalType("node");
      try {
        await runWorkspaceProject(tree, (text, type: "input" | "output" | "error" | "info" | "success" = "output") => addTerminalLine({ text, type }), setPreviewUrl);
        setActivePanel("preview");
      } catch (e) {
        addTerminalLine({ text: e instanceof Error ? e.message : String(e), type: "error" });
      } finally { setBusy(false); }
      return;
    }
    if (command === "run" && parts[1]) {
      const target = findFileByName(useIDEStore.getState().fileTree, parts.slice(1).join(" "));
      if (!target?.content) { addTerminalLine({ text: `run: ${parts[1]}: not found`, type: "error" }); return; }
      setBusy(true);
      try {
        await executeFile(target);
      } finally { setBusy(false); }
      return;
    }
    if (isPackageCommand(command)) {
      setBusy(true);
      try {
        await runSandboxCommand(command, parts.slice(1), useIDEStore.getState().fileTree, (text, type: "input" | "output" | "error" | "info" | "success" = "output") => addTerminalLine({ text, type }), setPreviewUrl);
      } catch (e) {
        addTerminalLine({ text: e instanceof Error ? e.message : String(e), type: "error" });
      } finally { setBusy(false); }
      return;
    }
    if (["node", "python", "python3", "bash", "sh"].includes(command) && parts[1]) {
      const target = fileFromCommandParts(useIDEStore.getState().fileTree, parts.slice(1));
      if (target?.content) {
        setBusy(true);
        try { await executeFile(target); } finally { setBusy(false); }
        return;
      }
    }
    if (command === "version") { addTerminalLine({ text: "SK Coder v1.0.0", type: "info" }); return; }
    if (command === "date") { addTerminalLine({ text: new Date().toString(), type: "output" }); return; }
    if (command === "whoami") { addTerminalLine({ text: "developer", type: "output" }); return; }
    if (command === "tree") {
      const print = (nodes: FileNode[], prefix: string) => {
        nodes.forEach((n, i) => {
          const last = i === nodes.length - 1;
          addTerminalLine({ text: `${prefix}${last ? "└── " : "├── "}${n.name}`, type: "output" });
          if (n.children) print(n.children, prefix + (last ? "    " : "│   "));
        });
      };
      addTerminalLine({ text: ".", type: "output" });
      print(useIDEStore.getState().fileTree, "");
      return;
    }

    if (current.id === "python") {
      setBusy(true);
      try { await runPython(cmd, (s) => addTerminalLine({ text: s, type: "output" })); }
      catch (e) { addTerminalLine({ text: e instanceof Error ? e.message : String(e), type: "error" }); }
      finally { setBusy(false); }
      return;
    }
    if (current.id === "javascript") {
      setBusy(true);
      try { await runJS(cmd, (s, t) => addTerminalLine({ text: s, type: t === "error" ? "error" : "output" })); }
      catch (e) { addTerminalLine({ text: e instanceof Error ? e.message : String(e), type: "error" }); }
      finally { setBusy(false); }
      return;
    }
    if (current.id === "node") {
      setBusy(true);
      setLastRun({ ext: "js", source: cmd, label: "Node input" });
      try { await runNodeSource(cmd); }
      catch (e) { addTerminalLine({ text: e instanceof Error ? e.message : String(e), type: "error" }); }
      finally { setBusy(false); }
      return;
    }
    if (current.cloudExt) {
      setBusy(true);
      try {
        setLastRun({ ext: current.cloudExt, source: cmd, label: `${current.label} input` });
        addTerminalLine({ text: `Queued ${current.label} job...`, type: "info" });
        showCloudResult(await runViaPiston(current.cloudExt, cmd), addTerminalLine);
      } finally { setBusy(false); }
      return;
    }
    addTerminalLine({ text: `${command}: command not found. Type help.`, type: "error" });
  }, [busy, current, addTerminalLine, clearTerminal, cwd, executeFile, runNodeSource, setActivePanel, setPreviewUrl, setTerminalType, termuxOk]);

  useEffect(() => {
    if (!terminalBridgeCmd || busy) return;
    const targetTab = terminalBridgeCmd.targetTab || "shell";
    setTabKind("local");
    setActivePanel("terminal");
    setActiveTerminalKey(`default-${targetTab}`);
    setTerminalType(targetTab as TerminalType);
    setTerminalBridgeCmd(null);
    void handleCommand(terminalBridgeCmd.cmd);
  }, [busy, handleCommand, setActivePanel, setTerminalBridgeCmd, setTerminalType, terminalBridgeCmd]);

  const copyLast = useCallback(() => {
    const text = history[history.length - 1];
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 1500);
  }, [history]);

  const KIND_TABS: { id: TabKind; label: string; icon: LucideIcon }[] = [
    { id: "local", label: "Local", icon: Cloud },
    { id: "server", label: "Oracle Terminal", icon: Cloud },
    { id: "cloud", label: "Cloud Shell", icon: Cloud },
    { id: "termux", label: "Termux", icon: Smartphone },
  ];

  return (
    <div className="h-full flex flex-col bg-terminal-bg">
      <div className="flex items-center gap-1 px-1 border-b border-border shrink-0 bg-card/40">
        {KIND_TABS.map((k) => (
          <button
            key={k.id}
            onClick={() => setTabKind(k.id)}
            className={`px-3 py-1.5 text-[11px] font-semibold whitespace-nowrap transition-colors ${tabKind === k.id ? "text-foreground border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}
          >
            {k.label}
          </button>
        ))}
      </div>

      {tabKind === "cloud" && <div className="flex-1 min-h-0"><CloudShell /></div>}
      {tabKind === "server" && <div className="flex-1 min-h-0"><BackendTerminal /></div>}
      {tabKind === "termux" && <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin"><TermuxSetup /></div>}
      {tabKind === "local" && (
        <>
      <div className="flex items-center gap-1 px-1 border-b border-border shrink-0 overflow-x-auto no-scrollbar">
        {terminalTabs.map((tab) => (
          <div key={tab.key} className={`flex items-center rounded-t transition-colors ${activeTerminalKey === tab.key ? "bg-card border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}>
            <button
              onClick={() => selectTerminal(tab.key, tab.terminal.id)}
              className={`px-2.5 py-1.5 text-[11px] font-medium whitespace-nowrap ${activeTerminalKey === tab.key ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {tab.terminal.label}
            </button>
            {tab.closable && <button type="button" aria-label={`Close ${tab.terminal.label}`} onClick={() => closeAddedTerminal(tab.key)} className="mr-1 rounded p-0.5 text-muted-foreground hover:bg-secondary hover:text-foreground"><X className="h-3 w-3" /></button>}
          </div>
        ))}
        <button type="button" aria-label="Add terminal" onClick={addTerminal} className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"><Plus className="h-3.5 w-3.5" /></button>
        <div className="ml-auto flex items-center gap-1 px-1">
          {lastRun && (supportsWandbox(lastRun.ext) || lastRun.ext === "bash") && (
            <button onClick={retryLast} disabled={busy} className="p-1 hover:bg-secondary rounded text-muted-foreground disabled:opacity-40" title="Retry last cloud run">
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={copyLast} className="p-1 hover:bg-secondary rounded text-muted-foreground" title="Copy command">
            {copiedCmd ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <button onClick={clearTerminal} className="p-1 hover:bg-secondary rounded text-muted-foreground" title="Clear">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      {current.cloudExt && current.hint && <div className="bg-info/10 text-[11px] text-muted-foreground px-3 py-1.5 border-b border-border flex items-center gap-1.5"><Cloud className="w-3 h-3" />{current.hint}</div>}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-2 font-mono text-xs leading-5">
        {terminalLines.map((line) => {
          const clickable = Boolean(line.filePath && line.lineNumber);
          return (
            <button
              key={line.id}
              type="button"
              onClick={() => {
                if (!line.filePath) return;
                const target = findFileByName(useIDEStore.getState().fileTree, line.filePath);
                if (target) {
                  openFile(target);
                  setEditorTarget({ path: target.path, lineNumber: line.lineNumber || 1, columnNumber: line.columnNumber });
                  setActivePanel("editor");
                }
              }}
              className={`${clickable ? "underline decoration-dotted text-left cursor-pointer" : "cursor-text"} block w-full ${line.type === "error" ? "text-destructive whitespace-pre-wrap" : line.type === "info" ? "text-info whitespace-pre-wrap" : line.type === "input" ? "text-success font-medium whitespace-pre-wrap" : line.type === "success" ? "text-success whitespace-pre-wrap" : "text-foreground whitespace-pre-wrap"}`}
            >{line.text}</button>
          );
        })}
        {busy && <div className="text-info animate-pulse">Working...</div>}
        <div ref={bottomRef} />
      </div>
      <div className="flex items-center border-t border-border px-2 py-1.5 shrink-0 gap-1">
        <span className="text-success text-xs font-mono font-bold shrink-0">{current.prompt}</span>
        <input
          type="text"
          disabled={busy}
          className="flex-1 bg-transparent text-xs font-mono text-foreground outline-none placeholder:text-muted-foreground/40 disabled:opacity-50"
          placeholder={busy ? "Executing..." : current.cloudExt ? `Type ${current.cloudExt} code, Enter to compile & run...` : "Type a command..."}
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.currentTarget.value.trim()) {
              const v = e.currentTarget.value.trim();
              e.currentTarget.value = "";
              handleCommand(v);
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              const ni = Math.min(hIdx + 1, history.length - 1);
              setHIdx(ni);
              if (history.length) e.currentTarget.value = history[history.length - 1 - ni] || "";
            }
            if (e.key === "ArrowDown") {
              e.preventDefault();
              const ni = Math.max(hIdx - 1, -1);
              setHIdx(ni);
              e.currentTarget.value = ni >= 0 ? history[history.length - 1 - ni] || "" : "";
            }
          }}
        />
      </div>
        </>
      )}
    </div>
  );
}

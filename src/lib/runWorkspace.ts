import type { ActivePanel, FileNode, TerminalType } from "@/types/ide"
import { htmlToDataUrl, buildHtmlPreview } from "@/lib/previewBuilder"
import { runJS } from "@/lib/jsRunner"
import { runPython } from "@/lib/pyodideRunner"
import { runViaPiston, type CloudResult } from "@/lib/pistonRunner"
import { runViaWandbox } from "@/lib/wandboxRunner"

type RunOptions = { activeTab?: { fileId?: string; name: string; path: string; language: string; content: string }; fileTree: FileNode[]; addTerminalLine: (line: { text: string; type: "input" | "output" | "error" | "info" | "success" }) => void; setPreviewUrl: (url: string) => void; setActivePanel: (panel: ActivePanel) => void; setTerminalType: (type: TerminalType) => void }

function publishResult(result: CloudResult, addTerminalLine: RunOptions["addTerminalLine"]) {
  if (result.compileStderr) result.compileStderr.split("\n").forEach((text) => text && addTerminalLine({ text, type: "error" }))
  if (result.stdout) result.stdout.split("\n").forEach((text) => text && addTerminalLine({ text, type: "output" }))
  if (result.stderr) result.stderr.split("\n").forEach((text) => text && addTerminalLine({ text, type: "error" }))
  if (result.message && !result.offline) addTerminalLine({ text: result.message, type: "error" })
  if (!result.stdout && !result.stderr && !result.compileStderr && !result.message) addTerminalLine({ text: "(no output)", type: "output" })
  addTerminalLine({ text: `exit ${result.code ?? (result.ok ? 0 : 1)}`, type: result.ok ? "success" : "error" })
}

export async function runWorkspace(options: RunOptions) {
  const tab = options.activeTab
  if (!tab) { options.addTerminalLine({ text: "Open a file before running.", type: "info" }); return }
  const ext = tab.name.split(".").pop()?.toLowerCase()
  if (ext === "html" || ext === "htm") { options.setPreviewUrl(htmlToDataUrl(buildHtmlPreview({ id: tab.fileId ?? tab.path, name: tab.name, path: tab.path, type: "file", content: tab.content }, options.fileTree))); options.setActivePanel("preview"); return }
  options.setActivePanel("terminal")
  if (ext === "py") { options.setTerminalType("python"); await runPython(tab.content, (text) => options.addTerminalLine({ text, type: "output" })); return }
  if (["js", "mjs", "cjs"].includes(ext ?? "")) {
    options.setTerminalType("node")
    options.addTerminalLine({ text: "Running Node.js with Wandbox...", type: "info" })
    const result = await runViaWandbox(ext!, tab.content)
    if (!result.offline) { publishResult(result, options.addTerminalLine); return }
    options.addTerminalLine({ text: "Wandbox is unavailable. Running this standalone script in the browser.", type: "info" })
    await runJS(tab.content, (text, type = "output") => options.addTerminalLine({ text, type }))
    return
  }
  if (ext === "bash" || ext === "sh") {
    options.setTerminalType("bash")
    options.addTerminalLine({ text: "Running Bash with the cloud fallback...", type: "info" })
    publishResult(await runViaPiston("bash", tab.content, "", tab.path), options.addTerminalLine)
    return
  }
  options.addTerminalLine({ text: `The .${ext ?? ""} runner is planned for Phase 2. Phase 1 supports Python, Node.js, and Bash.`, type: "info" })
}

import { useIDEStore } from "@/store/ideStore"
import { buildPreview } from "@/lib/previewBuilder"
import { runWithPiston, detectLanguageFromExtension } from "@/lib/pistonRunner"
import { runOnBackend, isBackendAvailable } from "@/lib/backendRunner"
import { parseErrors } from "@/components/ide/ErrorPanel"
import { toast } from "sonner"

export default function TopBar() {
  const {
    isRunning, setIsRunning, fileTree, activeTabId,
    addTerminalLine, clearTerminal, setActivePanel, setShowSettings, getActiveFile,
    setPreviewContent, refreshPreview, setErrors,
    settings,
  } = useIDEStore()

  const activeFile = getActiveFile()

  async function handleRun() {
    if (isRunning) {
      setIsRunning(false)
      addTerminalLine({ type: "info", content: "Execution stopped." })
      return
    }

    if (!activeFile) {
      toast.error("Open a file first")
      return
    }

    const ext = activeFile.name.split(".").pop()?.toLowerCase() || ""
    const code = activeFile.content || ""

    if (["html", "htm"].includes(ext)) {
      const html = buildPreview(fileTree, activeFile.path)
      setPreviewContent(html)
      refreshPreview()
      setActivePanel("preview")
      toast.success("Preview updated")
      return
    }

    setActivePanel("terminal")
    clearTerminal()
    setErrors([])
    setIsRunning(true)

    try {
      const backendLangs: Record<string, string> = {
        py: "python", js: "node", jsx: "node", ts: "node", tsx: "node",
        java: "java", cpp: "cpp", c: "c", rs: "rust", go: "go",
        sh: "bash", bash: "bash",
      }

      const backendLang = backendLangs[ext]
      const backOk = backendLang ? await isBackendAvailable() : false

      if (backOk && backendLang) {
        addTerminalLine({ type: "info", content: `▶ Running ${activeFile.name} via backend...` })
        const res = await runOnBackend(backendLang, code)
        if (!res.error) {
          if (res.stdout) for (const l of res.stdout.trimEnd().split("\n")) addTerminalLine({ type: "output", content: l })
          if (res.stderr) {
            for (const l of res.stderr.trimEnd().split("\n")) addTerminalLine({ type: "error", content: l })
            const errs = parseErrors(res.stderr, activeFile.name)
            if (errs.length) setErrors(errs)
          }
          if (!res.stdout && !res.stderr) addTerminalLine({ type: "info", content: "(no output)" })
           addTerminalLine({
             type: res.exitCode === 0 ? "success" : "error",
             content: `${res.exitCode === 0 ? "✓ Completed" : "✕ Failed"}  ⏱ ${res.executionTime}ms  exit ${res.exitCode}`,
           })
          return
        }
      }

      const pistonLang = detectLanguageFromExtension(activeFile.name)
      if (pistonLang) {
         addTerminalLine({ type: "info", content: `▶ Running ${activeFile.name} via public ${pistonLang} runner...` })
         const res = await runWithPiston(code, pistonLang, settings.piston.serverUrl)
        if (res.output) for (const l of res.output.split("\n")) addTerminalLine({ type: "output", content: l })
        if (res.stderr) for (const l of res.stderr.split("\n")) addTerminalLine({ type: "error", content: l })
        if (!res.output && !res.stderr) addTerminalLine({ type: "info", content: "(no output)" })
         addTerminalLine({
           type: res.exitCode === 0 ? "success" : "error",
           content: res.exitCode === 0 ? "✓ Completed" : `✕ Failed (exit ${res.exitCode})`,
         })
        return
      }

      toast.info(`No runner for .${ext} files — open the Terminal tab and use 'run ${activeFile.name}'`)
    } finally {
      setIsRunning(false)
    }
  }

  const ext = activeFile?.name.split(".").pop()?.toLowerCase() || ""
  const isHtml = ["html", "htm"].includes(ext)
  const runLabel = isHtml ? "Preview" : "Run"

  return (
    <div className="ide-topbar">
      <div className="topbar-logo">
        <div className="topbar-logo-icon">SK</div>
        <span>Coder</span>
      </div>

      {activeFile && (
        <>
          <div className="topbar-divider" />
          <span className="topbar-breadcrumb">
            {activeFile.name}
          </span>
        </>
      )}

      <div className="topbar-actions">
        <button
          className={`topbar-run-btn${isRunning ? " running" : ""}${!activeFile && !isRunning ? " disabled" : ""}`}
          onClick={handleRun}
          title={isRunning ? "Stop execution" : activeFile ? `${runLabel} ${activeFile.name}` : "Open a file to run"}
          style={{ opacity: !activeFile && !isRunning ? 0.5 : 1 }}
        >
          {isRunning ? (
            <svg width="10" height="10" viewBox="0 0 12 12" fill="currentColor">
              <rect x="2" y="2" width="3" height="8" rx="1"/>
              <rect x="7" y="2" width="3" height="8" rx="1"/>
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 12 12" fill="currentColor">
              <polygon points="2,1 11,6 2,11"/>
            </svg>
          )}
          {isRunning ? "Stop" : runLabel}
        </button>

        <button className="btn-icon" onClick={() => setShowSettings(true)} title="Settings">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>
      </div>
    </div>
  )
}

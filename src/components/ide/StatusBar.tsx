import { useIDEStore } from "@/store/ideStore"

export default function StatusBar() {
  const { getActiveFile, settings, isRunning, terminalType, setActivePanel, setShowSettings, setSettingsTab } = useIDEStore()
  const activeFile = getActiveFile()

  function openAISettings() {
    setShowSettings(true)
    setSettingsTab("ai")
  }

  const keyStatus = settings.ai.keyStatus
  const keyDot =
    keyStatus === "valid" ? <span style={{ color: "#a6e3a1" }}>●</span> :
    keyStatus === "invalid" ? <span style={{ color: "#f38ba8" }}>●</span> :
    keyStatus === "expired" ? <span style={{ color: "#f9e2af" }}>●</span> :
    <span style={{ color: "rgba(255,255,255,0.4)" }}>○</span>

  return (
    <div className="status-bar">
      <div className="status-bar-item" title="SK Coder by Saqlain King">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="white" stroke="none">
          <circle cx="12" cy="12" r="4" opacity="0.8"/>
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="white" strokeWidth="2" fill="none"/>
        </svg>
        <span>SK Coder</span>
      </div>

      {isRunning && (
        <div className="status-bar-item">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            style={{ animation: "spin 1.2s linear infinite" }}>
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
          <span>Running...</span>
        </div>
      )}

      {activeFile && (
        <div className="status-bar-item" title={activeFile.path}>
          <span>{activeFile.language || "plaintext"}</span>
        </div>
      )}

      <div style={{ marginLeft: "auto" }} />

      <div
        className="status-bar-item clickable"
        onClick={() => setActivePanel("terminal")}
        title="Switch terminal"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="4 17 10 11 4 5"/>
          <line x1="12" y1="19" x2="20" y2="19"/>
        </svg>
        <span>{terminalType}</span>
      </div>

      <div
        className="status-bar-item clickable"
        onClick={openAISettings}
        title={`AI: ${keyStatus}`}
      >
        {keyDot}
        <span>AI</span>
      </div>
    </div>
  )
}

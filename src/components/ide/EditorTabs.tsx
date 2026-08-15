import { useIDEStore } from "@/store/ideStore"
import { formatCode, isSupportedLanguage } from "@/lib/formatter"
import { toast } from "sonner"

function getFileIcon(language: string): string {
  const icons: Record<string, string> = {
    html: "🌐", css: "🎨", javascript: "🟨", typescript: "🔷",
    python: "🐍", cpp: "⚙️", c: "⚙️", java: "☕", kotlin: "🦾",
    rust: "🦀", go: "🐹", ruby: "💎", php: "🐘", swift: "🍎",
    markdown: "📝", json: "📋", yaml: "📄", xml: "📰", shell: "💻",
    sql: "🗄️", dart: "🎯", r: "📊", plaintext: "📄",
  }
  return icons[language] || "📄"
}

export default function EditorTabs() {
  const {
    openTabs, activeTabId, setActiveTab, closeTab,
    getActiveFile, getFileContent, updateFileContent, markTabModified, settings,
  } = useIDEStore()

  const activeFile = getActiveFile()
  const canFormat = activeFile && isSupportedLanguage(activeFile.language || "")

  async function handleFormat() {
    if (!activeFile) return
    const lang = activeFile.language || "plaintext"
    if (!isSupportedLanguage(lang)) { toast.info(`No formatter for ${lang}`); return }
    const code = getFileContent(activeFile.path) || activeFile.content || ""
    toast.loading("Formatting…", { id: "fmt" })
    const { formatted, error } = await formatCode(code, lang, settings.editor.tabSize)
    if (error) { toast.error(error, { id: "fmt" }); return }
    if (formatted === code) { toast.success("Already formatted", { id: "fmt" }); return }
    updateFileContent(activeFile.path, formatted)
    if (activeTabId) markTabModified(activeTabId, true)
    toast.success("Formatted", { id: "fmt" })
  }

  if (openTabs.length === 0) {
    return (
      <div className="ide-tabs-bar" style={{ alignItems: "center", padding: "0 1rem" }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
          Open a file from the explorer →
        </span>
      </div>
    )
  }

  return (
    <div className="ide-tabs-bar">
      <div style={{ display: "flex", flex: 1, minWidth: 0, overflowX: "auto", overflowY: "hidden" }}>
        {openTabs.map((tab) => (
          <div
            key={tab.id}
            className={`ide-tab ${tab.id === activeTabId ? "active" : ""} ${tab.modified ? "modified" : ""}`}
            onClick={() => setActiveTab(tab.id)}
            title={tab.path}
          >
            <span style={{ fontSize: 11 }}>{getFileIcon(tab.language)}</span>
            <span>{tab.name}</span>
            {tab.modified && (
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", display: "inline-block", marginLeft: 2 }} />
            )}
            <button
              className="ide-tab-close"
              onClick={(e) => { e.stopPropagation(); closeTab(tab.id) }}
              title="Close tab"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {canFormat && (
        <button
          className="btn-icon"
          onClick={handleFormat}
          title="Format code (Shift+Alt+F)"
          style={{ flexShrink: 0, marginRight: 4 }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="4 7 4 4 20 4 20 7"/>
            <line x1="9" y1="20" x2="15" y2="20"/>
            <line x1="12" y1="4" x2="12" y2="20"/>
          </svg>
        </button>
      )}
    </div>
  )
}

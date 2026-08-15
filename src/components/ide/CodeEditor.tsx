import { useRef, useEffect, useCallback } from "react"
import MonacoEditor, { OnMount } from "@monaco-editor/react"
import { useIDEStore } from "@/store/ideStore"
import { formatCode, isSupportedLanguage } from "@/lib/formatter"
import { toast } from "sonner"

export default function CodeEditor() {
  const {
    openTabs, activeTabId, getActiveFile, getFileContent,
    updateFileContent, markTabModified, settings, setIsRunning,
    addTerminalLine, setActivePanel,
  } = useIDEStore()

  const activeFile = getActiveFile()
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null)
  const monacoRef = useRef<Parameters<OnMount>[1] | null>(null)

  const handleFormat = useCallback(async () => {
    const editor = editorRef.current
    if (!editor || !activeFile) return
    const lang = activeFile.language || "plaintext"
    if (!isSupportedLanguage(lang)) {
      toast.info(`No formatter for ${lang}`)
      return
    }
    const code = editor.getValue()
    toast.loading("Formatting…", { id: "fmt" })
    const { formatted, error } = await formatCode(code, lang, settings.editor.tabSize, settings.editor.tabSize === 0)
    if (error) {
      toast.error(error, { id: "fmt" })
      return
    }
    if (formatted === code) {
      toast.success("Already formatted", { id: "fmt" })
      return
    }
    const model = editor.getModel()
    if (model) {
      const op = { range: model.getFullModelRange(), text: formatted }
      model.applyEdits([op])
      updateFileContent(activeFile.path, formatted)
      if (activeTabId) markTabModified(activeTabId, true)
    }
    toast.success("Formatted", { id: "fmt" })
  }, [activeFile, activeTabId, settings.editor.tabSize, updateFileContent, markTabModified])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.shiftKey && e.altKey && e.code === "KeyF") ||
          (e.shiftKey && (e.metaKey || e.ctrlKey) && e.code === "KeyF")) {
        e.preventDefault()
        handleFormat()
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [handleFormat])

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor
    monacoRef.current = monaco

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      const model = editor.getModel()
      if (model && activeFile) {
        updateFileContent(activeFile.path, model.getValue())
        markTabModified(activeTabId || "", false)
      }
    })

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyP, () => {
      editor.getAction("editor.action.quickCommand")?.run()
    })

    editor.addCommand(monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF, () => {
      handleFormat()
    })

    monaco.editor.defineTheme("sk-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "6c7086", fontStyle: "italic" },
        { token: "keyword", foreground: "cba6f7" },
        { token: "string", foreground: "a6e3a1" },
        { token: "number", foreground: "fab387" },
        { token: "type", foreground: "89b4fa" },
        { token: "function", foreground: "89dceb" },
        { token: "variable", foreground: "cdd6f4" },
      ],
      colors: {
        "editor.background": "#1e1e2e",
        "editor.foreground": "#cdd6f4",
        "editorLineNumber.foreground": "#45475a",
        "editorLineNumber.activeForeground": "#7f849c",
        "editor.lineHighlightBackground": "#24273a",
        "editor.selectionBackground": "#45475a",
        "editor.wordHighlightBackground": "#313244",
        "editorCursor.foreground": "#007acc",
        "editorIndentGuide.background": "#313244",
        "editorIndentGuide.activeBackground": "#45475a",
        "scrollbarSlider.background": "#31324460",
        "scrollbarSlider.hoverBackground": "#45475a80",
        "editorSuggestWidget.background": "#1e1e2e",
        "editorSuggestWidget.border": "#313244",
        "editorSuggestWidget.selectedBackground": "#313244",
      },
    })
    monaco.editor.setTheme("sk-dark")
  }

  const activeContent = activeFile ? (getFileContent(activeFile.path) || activeFile.content || "") : ""

  function handleChange(value: string | undefined) {
    if (!activeFile || value === undefined) return
    updateFileContent(activeFile.path, value)
    if (activeTabId) markTabModified(activeTabId, true)
  }

  if (!activeFile) {
    return (
      <div className="panel-placeholder">
        <div className="panel-placeholder-icon">⚡</div>
        <p style={{ fontWeight: 600, color: "var(--text-primary)" }}>SK Coder IDE</p>
        <p style={{ fontSize: 12 }}>Open a file from the explorer to start editing</p>
        <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: "0.5rem" }}>
          or drag & drop files into the sidebar
        </p>
      </div>
    )
  }

  return (
    <MonacoEditor
      height="100%"
      language={activeFile.language || "plaintext"}
      value={activeContent}
      onChange={handleChange}
      onMount={handleEditorMount}
      loading={
        <div className="monaco-loading">
          <div className="loading-spinner" />
          Loading editor...
        </div>
      }
      options={{
        fontSize: settings.editor.fontSize,
        fontFamily: settings.editor.fontFamily,
        fontLigatures: true,
        tabSize: settings.editor.tabSize,
        wordWrap: settings.editor.wordWrap,
        minimap: { enabled: settings.editor.minimap },
        lineNumbers: settings.editor.lineNumbers,
        bracketPairColorization: { enabled: settings.editor.bracketPairs },
        smoothScrolling: settings.editor.smoothScrolling,
        cursorStyle: settings.editor.cursorStyle,
        renderWhitespace: settings.editor.renderWhitespace,
        scrollBeyondLastLine: false,
        automaticLayout: true,
        contextmenu: true,
        quickSuggestions: true,
        suggestOnTriggerCharacters: true,
        autoIndent: "full",
        formatOnPaste: true,
        formatOnType: false,
        padding: { top: 12, bottom: 12 },
        scrollbar: {
          verticalScrollbarSize: 6,
          horizontalScrollbarSize: 6,
          useShadows: false,
        },
        overviewRulerLanes: 0,
        glyphMargin: false,
        folding: true,
        showFoldingControls: "mouseover",
        renderLineHighlight: "line",
        occurrencesHighlight: "singleFile",
        selectionHighlight: true,
        theme: "sk-dark",
      }}
    />
  )
}

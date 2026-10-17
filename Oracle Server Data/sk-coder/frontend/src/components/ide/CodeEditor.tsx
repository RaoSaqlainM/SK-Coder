import { useRef, useEffect, useCallback } from "react";
import MonacoEditor, { OnMount } from "@monaco-editor/react";
import { useIDEStore } from "@/store/ideStore";
import { formatCode, isSupportedLanguage } from "@/lib/formatter";
import { isBrowserAssetOnly } from "@/lib/browserAsset";
import { toast } from "sonner";
import { analyzeSourceSyntax } from "@/lib/syntaxDiagnostics";
export default function CodeEditor() {
    const { openTabs, activeTabId, getActiveFile, getFileContent, updateFileContent, saveWorkspaceToBackend, markTabModified, settings, setIsRunning, addTerminalLine, setActivePanel, errors, setErrors, } = useIDEStore();
    const activeFile = getActiveFile();
    const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
    const monacoRef = useRef<Parameters<OnMount>[1] | null>(null);
    const handleFormat = useCallback(async () => {
        const editor = editorRef.current;
        if (!editor || !activeFile)
            return;
        const lang = activeFile.language || "plaintext";
        if (!isSupportedLanguage(lang)) {
            toast.info(`No formatter for ${lang}`);
            return;
        }
        const code = editor.getValue();
        toast.loading("Formatting…", { id: "fmt" });
        const { formatted, error } = await formatCode(code, lang, settings.editor.tabSize, settings.editor.tabSize === 0);
        if (error) {
            toast.error(error, { id: "fmt" });
            return;
        }
        if (formatted === code) {
            toast.success("Already formatted", { id: "fmt" });
            return;
        }
        const model = editor.getModel();
        if (model) {
            const op = { range: model.getFullModelRange(), text: formatted };
            model.applyEdits([op]);
            updateFileContent(activeFile.path, formatted);
            if (activeTabId)
                markTabModified(activeTabId, true);
        }
        toast.success("Formatted", { id: "fmt" });
    }, [activeFile, activeTabId, settings.editor.tabSize, updateFileContent, markTabModified]);
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.shiftKey && e.altKey && e.code === "KeyF") ||
                (e.shiftKey && (e.metaKey || e.ctrlKey) && e.code === "KeyF")) {
                e.preventDefault();
                handleFormat();
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [handleFormat]);
    const handleEditorMount: OnMount = (editor, monaco) => {
        editorRef.current = editor;
        monacoRef.current = monaco;
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
            const model = editor.getModel();
            if (model && activeFile) {
                updateFileContent(activeFile.path, model.getValue());
                markTabModified(activeTabId || "", false);
                void saveWorkspaceToBackend();
            }
        });
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyP, () => {
            editor.getAction("editor.action.quickCommand")?.run();
        });
        editor.addCommand(monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF, () => {
            handleFormat();
        });
        editor.onMouseDown((event) => {
            if (event.event.detail !== 2)
                return;
            const state = useIDEStore.getState();
            if (state.activePanel === "editor")
                state.setSidebarOpen(!state.sidebarOpen);
        });
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
                "editorError.foreground": "#ff6b81",
                "editorError.border": "#ff6b81",
                "editorWarning.foreground": "#e3b341",
                "editorWarning.border": "#e3b341",
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
        });
        monaco.editor.setTheme("sk-dark");
    };
    const activeContent = activeFile ? (getFileContent(activeFile.path) || activeFile.content || "") : "";
    const assetOnly = isBrowserAssetOnly(activeFile);
    useEffect(() => {
        if (!activeFile)
            return;
        setErrors(analyzeSourceSyntax(activeContent, activeFile.language, activeFile.path));
    }, [activeFile?.path, activeFile?.language, activeContent, setErrors]);
    useEffect(() => {
        const editor = editorRef.current;
        const monaco = monacoRef.current;
        const model = editor?.getModel();
        if (!editor || !monaco || !model || !activeFile)
            return;
        const markers = errors
            .filter((error) => !error.file || error.file === activeFile.path || activeFile.path.endsWith(error.file))
            .map((error) => ({
            startLineNumber: Math.max(1, error.line),
            startColumn: Math.max(1, error.col || 1),
            endLineNumber: Math.max(1, error.line),
            endColumn: Math.max(2, (error.col || 1) + 1),
            message: error.message,
            severity: error.severity === "warning" ? monaco.MarkerSeverity.Warning : error.severity === "info" ? monaco.MarkerSeverity.Info : monaco.MarkerSeverity.Error,
        }));
        monaco.editor.setModelMarkers(model, "sk-coder-diagnostics", markers);
    }, [activeFile?.path, errors]);
    function handleChange(value: string | undefined) {
        if (!activeFile || value === undefined)
            return;
        updateFileContent(activeFile.path, value);
        if (activeTabId)
            markTabModified(activeTabId, true);
    }
    function applyTouchShortcut(value: string) {
        const editor = editorRef.current;
        if (!editor)
            return;
        if (value === "undo" || value === "redo") {
            void editor.getAction(value === "undo" ? "undo" : "redo")?.run();
            editor.focus();
            return;
        }
        const selection = editor.getSelection();
        if (selection)
            editor.executeEdits("touch-shortcut", [{ range: selection, text: value, forceMoveMarkers: true }]);
        editor.focus();
    }
    if (!activeFile || assetOnly) {
        return (<div className="panel-placeholder">
        <div style={{ width: 56, height: 56, borderRadius: 12, display: "grid", placeItems: "center", background: "rgba(0,122,204,0.16)", marginBottom: "0.75rem", boxShadow: "0 0 20px rgba(0,122,204,0.25)" }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
            <rect x="3" y="4" width="18" height="16" rx="3"/>
            <path d="M8 8h8"/><path d="M8 12h8"/><path d="M8 16h5"/>
          </svg>
        </div>
        <p style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: 15 }}>{assetOnly ? activeFile?.name || "Browser asset" : "SK Coder Workspace"}</p>
        <p style={{ fontSize: 12 }}>{assetOnly ? "This large source file is stored in this browser workspace and is ready for terminal staging." : "Open a file from the explorer to start editing"}</p>
        <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: "0.5rem" }}>{assetOnly ? "Open it in Terminal to work with the full file without replacing it with a blank editor buffer." : "or drag & drop files into the sidebar"}</p>
      </div>);
    }
    return (<div className="code-editor-shell"><div className="code-editor-canvas"><MonacoEditor height="100%" language={activeFile.language || "plaintext"} value={activeContent} onChange={handleChange} onMount={handleEditorMount} loading={<div className="monaco-loading">
          <div className="loading-spinner"/>
          Loading editor...
        </div>} options={{
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
            renderLineHighlight: "gutter",
            occurrencesHighlight: "singleFile",
            selectionHighlight: true,
            theme: "sk-dark",
        }}/></div><div className="code-editor-shortcuts" aria-label="Code editor shortcuts">
        {[["↶", "undo"], ["↷", "redo"], ["<", "<"], [">", ">"], ["/", "/"], ["\\", "\\"], ["{", "{"], ["}", "}"], ["(", "("], [")", ")"], ["[", "["], ["]", "]"], [";", ";"], ["'", "'"], ["\"", "\""], ["Tab", "\t"]].map(([label, value]) => <button key={`${label}-${value}`} type="button" onClick={() => applyTouchShortcut(value)}>{label}</button>)}
      </div></div>)
}

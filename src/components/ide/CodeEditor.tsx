import { lazy, Suspense, useRef, useCallback, useEffect, useState } from "react";
import type { OnMount, OnValidate } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { useIDEStore } from "@/store/ideStore";
import { FileCode } from "lucide-react";
import { chat, isKeyValidated } from "@/lib/aiClient";

export default function CodeEditor() {
  const { openTabs, activeTabId, updateTabContent, updateFileContent, settings, addTerminalLine, editorTarget, setErrors } = useIDEStore();
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAnalyzed = useRef<string>("");
  const activeTab = openTabs.find((t) => t.id === activeTabId);
  const [enhancedEditor, setEnhancedEditor] = useState(false);

  const handleEditorMount: OnMount = useCallback((editor) => {
    editorRef.current = editor;
    editor.focus();
  }, []);

  const handleValidate: OnValidate = useCallback((markers) => {
    if (!activeTab) return;
    const diagnostics = markers.map((marker, index) => ({
      id: `${activeTab.path}-${marker.startLineNumber}-${marker.startColumn}-${index}`,
      file: activeTab.path,
      line: marker.startLineNumber,
      col: marker.startColumn,
      message: marker.message,
      severity: marker.severity >= 8 ? "error" as const : marker.severity >= 4 ? "warning" as const : "info" as const
    }));
    setErrors([...useIDEStore.getState().errors.filter((error) => error.file !== activeTab.path), ...diagnostics]);
  }, [activeTab, setErrors]);

  const handleChange = useCallback(
    (value: string | undefined) => {
      if (!activeTab || value === undefined) return;
      updateTabContent(activeTab.id, value);
      if (settings.editor.autoSave) {
        updateFileContent(activeTab.path, value);
      }
    },
    [activeTab, updateTabContent, updateFileContent, settings.editor.autoSave]
  );

  useEffect(() => {
    if (!settings.ai.autoAnalyze || !activeTab || !isKeyValidated()) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const sig = activeTab.path + ":" + activeTab.content.length;
      if (sig === lastAnalyzed.current) return;
      lastAnalyzed.current = sig;
      if (activeTab.content.trim().length < 20) return;
      try {
        const { reply } = await chat([
          { role: "system", content: "You scan code for bugs. Reply with 'OK' if no issues, otherwise list 1-3 issues briefly with line numbers. Max 3 lines." },
          { role: "user", content: `File: ${activeTab.name}\n\n${activeTab.content.slice(0, 4000)}` },
        ]);
        if (reply && !/^ok\b/i.test(reply.trim())) {
          addTerminalLine({ text: `[AI] ${activeTab.name}: ${reply.slice(0, 300)}`, type: "info" });
        }
      } catch {
        lastAnalyzed.current = "";
      }
    }, 3000);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [activeTab, activeTab?.content, activeTab?.path, activeTab?.name, settings.ai.autoAnalyze, addTerminalLine]);

  useEffect(() => {
    if (!editorRef.current || !activeTab || !editorTarget || editorTarget.path !== activeTab.path) return;
    const position = { lineNumber: editorTarget.lineNumber, column: editorTarget.columnNumber || 1 };
    editorRef.current.setPosition(position);
    editorRef.current.revealPositionInCenter(position);
    editorRef.current.focus();
  }, [activeTab, activeTab?.path, editorTarget]);


  if (!activeTab) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-editor-bg text-muted-foreground gap-4">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <FileCode className="w-8 h-8 text-primary/40" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium mb-1">No file open</p>
          <p className="text-xs text-muted-foreground/60 max-w-[250px]">
            Select a file from the explorer, open a project, or create a new file to start coding
          </p>
        </div>
      </div>
    );
  }

  const MonacoEditor = lazy(() => import("@monaco-editor/react"));

  if (!enhancedEditor) {
    return <div className="relative h-full w-full bg-editor-bg">
      <textarea
        aria-label="Editor content"
        value={activeTab.content}
        onChange={(event) => handleChange(event.target.value)}
        spellCheck={false}
        className="h-full w-full resize-none bg-editor-bg px-4 pb-4 pt-12 font-mono text-sm leading-6 text-foreground outline-none"
        style={{ fontSize: settings.editor.fontSize, fontFamily: settings.editor.fontFamily, tabSize: settings.editor.tabSize }}
      />
      <button type="button" onClick={() => setEnhancedEditor(true)} className="absolute right-3 top-2 min-h-9 rounded border border-border bg-card px-2.5 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground">Enable enhanced editor</button>
    </div>;
  }

  return (
    <div className="h-full w-full">
      <Suspense fallback={<div className="h-full bg-editor-bg" />}>
      <MonacoEditor
        key={activeTab.id}
        height="100%"
        language={activeTab.language}
        value={activeTab.content}
        theme={settings.editor.theme}
        onChange={handleChange}
        onMount={handleEditorMount}
        onValidate={handleValidate}
        options={{
          fontSize: settings.editor.fontSize,
          fontFamily: settings.editor.fontFamily,
          tabSize: settings.editor.tabSize,
          wordWrap: settings.editor.wordWrap,
          minimap: { enabled: settings.editor.minimap },
          lineNumbers: settings.editor.lineNumbers,
          matchBrackets: settings.editor.bracketPairs ? "always" : "never",
          scrollBeyondLastLine: false,
          smoothScrolling: settings.editor.smoothScrolling,
          cursorBlinking: "smooth",
          cursorStyle: settings.editor.cursorStyle,
          cursorSmoothCaretAnimation: "on",
          renderWhitespace: settings.editor.renderWhitespace,
          automaticLayout: true,
          padding: { top: 8 },
          suggestOnTriggerCharacters: true,
          quickSuggestions: true,
          acceptSuggestionOnEnter: "on",
          folding: true,
          foldingStrategy: "indentation",
          bracketPairColorization: { enabled: true },
          guides: { bracketPairs: true, indentation: true },
          overviewRulerBorder: false,
          hideCursorInOverviewRuler: true,
          scrollbar: {
            verticalScrollbarSize: 6,
            horizontalScrollbarSize: 6,
          },
          contextmenu: true,
          formatOnPaste: true,
          formatOnType: false,
          autoClosingBrackets: "always",
          autoClosingQuotes: "always",
          autoIndent: "full",
          colorDecorators: true,
          linkedEditing: true,
          renderLineHighlight: "all",
          snippetSuggestions: "top",
        }}
      />
      </Suspense>
    </div>
  );
}

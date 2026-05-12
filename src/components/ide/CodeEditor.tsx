import { useRef, useCallback, useEffect } from "react";
import Editor, { OnMount } from "@monaco-editor/react";
import { useIDEStore } from "@/store/ideStore";
import { FileCode } from "lucide-react";
import { chat, isKeyValidated } from "@/lib/aiClient";

export default function CodeEditor() {
  const { openTabs, activeTabId, updateTabContent, updateFileContent, settings, addTerminalLine, editorTarget } = useIDEStore();
  const editorRef = useRef<any>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAnalyzed = useRef<string>("");
  const activeTab = openTabs.find((t) => t.id === activeTabId);

  const handleEditorMount: OnMount = useCallback((editor) => {
    editorRef.current = editor;
    editor.focus();
  }, []);

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
      } catch {}
    }, 3000);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [activeTab?.content, activeTab?.path, activeTab?.name, settings.ai.autoAnalyze, addTerminalLine]);

  useEffect(() => {
    if (!editorRef.current || !activeTab || !editorTarget || editorTarget.path !== activeTab.path) return;
    const position = { lineNumber: editorTarget.lineNumber, column: editorTarget.columnNumber || 1 };
    editorRef.current.setPosition(position);
    editorRef.current.revealPositionInCenter(position);
    editorRef.current.focus();
  }, [activeTab?.path, editorTarget]);


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

  return (
    <div className="h-full w-full">
      <Editor
        key={activeTab.id}
        height="100%"
        language={activeTab.language}
        value={activeTab.content}
        theme={settings.editor.theme}
        onChange={handleChange}
        onMount={handleEditorMount}
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
    </div>
  );
}

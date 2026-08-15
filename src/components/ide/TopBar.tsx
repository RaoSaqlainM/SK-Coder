import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bot, ChevronRight, Download, FilePlus, FolderOpen, HelpCircle, Menu, MoreVertical, Play, Settings, Square } from "lucide-react";
import { useIDEStore } from "@/store/ideStore";
import type { ImportResult, PickedFile } from "@/lib/importProject";
import { storeImportedWorkspace } from "@/lib/storageManager";

import NewFileDialog from "./NewFileDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";


export default function TopBar() {
  const {
    isRunning, setIsRunning, toggleSidebar, addTerminalLine, setActivePanel,
    openFile, setFileTree, closeAllTabs, fileTree, openTabs, activeTabId, setPreviewUrl,
    downloadProject, setAiChatOpen, setTerminalType, settings,
  } = useIDEStore();
  const [newFileOpen, setNewFileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pendingImport, setPendingImport] = useState<{ result: ImportResult; itemCount: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const activeTab = openTabs.find((t) => t.id === activeTabId);

  const applyImport = useCallback(async (result: ImportResult, itemCount: number, mode: "replace" | "merge") => {
    const { mergeFileTrees } = await import("@/lib/importProject");
    const { tree, firstOpenable } = result;
    const current = useIDEStore.getState().fileTree;
    const merged = mergeFileTrees(current, tree, mode);
    const nextTree = merged.tree;
    if (mode === "replace") closeAllTabs();
    setFileTree(nextTree);
    if (firstOpenable) openFile(firstOpenable);
    addTerminalLine({ text: `${mode === "replace" ? "Opened" : "Merged"} ${itemCount} item${itemCount === 1 ? "" : "s"} into the workspace.`, type: "success" });
    if (merged.conflicts) addTerminalLine({ text: `${merged.conflicts} existing file${merged.conflicts === 1 ? " was" : "s were"} replaced by the imported project.`, type: "info" });
    void storeImportedWorkspace(nextTree, settings.backend.url, settings.backend.enabled).then((result) => addTerminalLine({ text: result.message, type: result.target === "server" ? "info" : "success" }));
  }, [addTerminalLine, closeAllTabs, openFile, setFileTree, settings.backend.enabled, settings.backend.url]);

  const importPicked = useCallback(async (picked: PickedFile[]) => {
    const { pickedFilesToTree } = await import("@/lib/importProject");
    const result = await pickedFilesToTree(picked, (text, type = "info") => addTerminalLine({ text, type }));
    if (!result.tree.length) return;
    if (useIDEStore.getState().fileTree.length) {
      setPendingImport({ result, itemCount: picked.length });
      return;
    }
    await applyImport(result, picked.length, "replace");
  }, [addTerminalLine, applyImport]);

  useEffect(() => {
    const handleImport = (event: Event) => {
      const files = (event as CustomEvent<PickedFile[]>).detail;
      if (files?.length) void importPicked(files);
    };
    document.addEventListener("sk-coder-import", handleImport);
    return () => document.removeEventListener("sk-coder-import", handleImport);
  }, [importPicked]);

  const handleFileInput = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    const { filesFromFileList } = await import("@/lib/importProject");
    await importPicked(filesFromFileList(e.target.files));
    e.target.value = "";
  }, [importPicked]);

  const handleOpen = useCallback(() => {
    setMenuOpen(false);
    fileInputRef.current?.click();
  }, []);

  const handleOpenFolder = useCallback(() => {
    setMenuOpen(false);
    folderInputRef.current?.click();
  }, []);

  const handleRun = useCallback(async () => {
    if (isRunning) {
      setIsRunning(false);
      addTerminalLine({ text: "Stopped.", type: "info" });
      return;
    }
    setIsRunning(true);
    try {
      const { runWorkspace } = await import("@/lib/runWorkspace");
      await runWorkspace({ activeTab, fileTree, addTerminalLine, setPreviewUrl, setActivePanel, setTerminalType });
    } catch (error) {
      setActivePanel("terminal");
      addTerminalLine({ text: error instanceof Error ? error.message : String(error), type: "error" });
    } finally {
      setIsRunning(false);
    }
  }, [activeTab, addTerminalLine, fileTree, isRunning, setActivePanel, setIsRunning, setPreviewUrl, setTerminalType]);

  const breadcrumb = activeTab?.path.split("/") || [];

  return (
    <>
      <div className="flex items-center justify-between bg-card border-b border-border h-11 px-2 shrink-0">
        <div className="flex items-center gap-1 min-w-0 flex-1">
          <button onClick={toggleSidebar} className="flex h-11 w-11 items-center justify-center rounded hover:bg-secondary transition-colors shrink-0" aria-label="Toggle sidebar">
            <Menu className="w-4 h-4 text-muted-foreground" />
          </button>
          <div className="hidden sm:flex items-center text-xs text-muted-foreground overflow-hidden min-w-0">
            {breadcrumb.length > 0 ? breadcrumb.map((part, i) => (
              <span key={i} className="flex items-center shrink-0">
                {i > 0 && <ChevronRight className="w-3 h-3 mx-0.5 shrink-0 opacity-50" />}
                <span className={i === breadcrumb.length - 1 ? "text-foreground truncate font-medium" : "truncate"}>{part}</span>
              </span>
            )) : <span className="text-muted-foreground font-medium">SK Coder</span>}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={handleOpen} className="flex h-11 items-center gap-1.5 px-2.5 text-xs font-medium rounded bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors" aria-label="Open file or archive">
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Open</span>
          </button>
          <button
            onClick={handleRun}
            aria-label={isRunning ? "Stop running workspace" : "Run workspace"}
            className={`flex h-11 w-11 items-center justify-center rounded transition-all ${isRunning ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground hover:bg-primary/90"}`}
          >
            {isRunning ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            <span className="hidden sm:inline">{isRunning ? "Stop" : "Run"}</span>
          </button>
          <button onClick={() => setAiChatOpen(true)} className="flex h-11 w-11 items-center justify-center rounded hover:bg-secondary transition-colors" aria-label="Code analyzer">
            <Bot className="w-4 h-4 text-primary" />
          </button>
          <div className="relative">
            <button onClick={() => setMenuOpen((v) => !v)} className="flex h-11 w-11 items-center justify-center rounded hover:bg-secondary transition-colors" aria-label="Menu">
              <MoreVertical className="w-4 h-4 text-muted-foreground" />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-1 bg-popover border border-border rounded-md shadow-2xl py-1 min-w-[190px] z-50 animate-fade-in">
                  <button onClick={handleOpenFolder} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-popover-foreground hover:bg-accent transition-colors">
                    <FolderOpen className="w-4 h-4" />
                    Select Folder
                  </button>
                  <button onClick={() => { setNewFileOpen(true); setMenuOpen(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-popover-foreground hover:bg-accent transition-colors">
                    <FilePlus className="w-4 h-4" />
                    New
                  </button>
                  <button onClick={() => { downloadProject(); setMenuOpen(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-popover-foreground hover:bg-accent transition-colors">
                    <Download className="w-4 h-4" />
                    Download Project
                  </button>
                  <div className="h-px bg-border my-1" />
                  <button onClick={() => { setActivePanel("settings"); setMenuOpen(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-popover-foreground hover:bg-accent transition-colors">
                    <Settings className="w-4 h-4" />
                    Settings
                  </button>
                  <Link to="/guide" onClick={() => setMenuOpen(false)} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-popover-foreground hover:bg-accent transition-colors">
                    <HelpCircle className="w-4 h-4" />
                    User Guide
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileInput} />
      <input ref={folderInputRef} type="file" multiple {...({ webkitdirectory: "", directory: "" } as Record<string, string>)} className="hidden" onChange={handleFileInput} />
      <NewFileDialog open={newFileOpen} onClose={() => setNewFileOpen(false)} parentPath="" />
      <AlertDialog open={Boolean(pendingImport)} onOpenChange={(open) => { if (!open) setPendingImport(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Open project into this workspace?</AlertDialogTitle>
            <AlertDialogDescription>Replace starts a clean workspace. Merge keeps current files and replaces matching imported paths.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <button type="button" onClick={() => { if (pendingImport) void applyImport(pendingImport.result, pendingImport.itemCount, "merge"); setPendingImport(null); }} className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium transition-colors hover:bg-accent">Merge</button>
            <AlertDialogAction onClick={() => { if (pendingImport) void applyImport(pendingImport.result, pendingImport.itemCount, "replace"); setPendingImport(null); }}>Replace</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

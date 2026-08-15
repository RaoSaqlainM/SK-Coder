import { useState, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { Bot, ChevronRight, Download, FilePlus, FolderOpen, HelpCircle, Menu, MoreVertical, Play, Settings, Square } from "lucide-react";
import { useIDEStore } from "@/store/ideStore";
import { filesFromFileList, pickedFilesToTree } from "@/lib/importProject";
import { runWorkspace } from "@/lib/runWorkspace";

import NewFileDialog from "./NewFileDialog";


export default function TopBar() {
  const {
    isRunning, setIsRunning, toggleSidebar, addTerminalLine, setActivePanel,
    openFile, setFileTree, fileTree, openTabs, activeTabId, setPreviewUrl,
    downloadProject, setAiChatOpen, setTerminalType,
  } = useIDEStore();
  const [newFileOpen, setNewFileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const activeTab = openTabs.find((t) => t.id === activeTabId);

  const importPicked = useCallback(async (picked: ReturnType<typeof filesFromFileList>) => {
    const { tree, firstOpenable } = await pickedFilesToTree(picked, (text, type = "info") => addTerminalLine({ text, type }));
    if (!tree.length) return;
    const current = useIDEStore.getState().fileTree;
    setFileTree([...current, ...tree]);
    if (firstOpenable) openFile(firstOpenable);
    addTerminalLine({ text: `Opened ${picked.length} item(s) into workspace`, type: "success" });
  }, [addTerminalLine, openFile, setFileTree]);

  const handleFileInput = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
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
          <button onClick={toggleSidebar} className="p-2 rounded hover:bg-secondary transition-colors shrink-0" aria-label="Toggle sidebar">
            <Menu className="w-4 h-4 text-muted-foreground" />
          </button>
          <div className="flex items-center text-xs text-muted-foreground overflow-hidden min-w-0">
            {breadcrumb.length > 0 ? breadcrumb.map((part, i) => (
              <span key={i} className="flex items-center shrink-0">
                {i > 0 && <ChevronRight className="w-3 h-3 mx-0.5 shrink-0 opacity-50" />}
                <span className={i === breadcrumb.length - 1 ? "text-foreground truncate font-medium" : "truncate"}>{part}</span>
              </span>
            )) : <span className="text-muted-foreground font-medium">SK Coder</span>}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={handleOpen} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors" aria-label="Open file or archive">
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Open</span>
          </button>
          <button
            onClick={handleRun}
            className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded transition-all ${isRunning ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground hover:bg-primary/90"}`}
          >
            {isRunning ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            <span className="hidden sm:inline">{isRunning ? "Stop" : "Run"}</span>
          </button>
          <button onClick={() => setAiChatOpen(true)} className="p-2 rounded hover:bg-secondary transition-colors" aria-label="Code analyzer">
            <Bot className="w-4 h-4 text-primary" />
          </button>
          <div className="relative">
            <button onClick={() => setMenuOpen((v) => !v)} className="p-2 rounded hover:bg-secondary transition-colors" aria-label="Menu">
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
    </>
  );
}

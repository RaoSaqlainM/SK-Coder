import { useIDEStore } from "@/store/ideStore";
import { Play, Trash2, FileText, Copy, PencilLine, Info, FilePlus, Share2, TerminalSquare } from "lucide-react";
import { useState, useCallback } from "react";
import NewFileDialog from "./NewFileDialog";
import { nodeToZipBlob, shareBlobOrDownload, shareTextOrDownload } from "@/lib/shareProject";
import { runWorkspace } from "@/lib/runWorkspace";

export default function ContextMenu() {
  const {
    contextMenu, setContextMenu, deleteFileNode, openFile, addTerminalLine,
    setActivePanel, fileTree, setPreviewUrl, setTerminalType,
  } = useIDEStore();
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState("");
  const [showNewFile, setShowNewFile] = useState(false);
  const [newFileParent, setNewFileParent] = useState("");

  const close = useCallback(() => {
    setContextMenu(null);
    setRenaming(false);
    setNewName("");
  }, [setContextMenu]);

  if (!contextMenu && !showNewFile) return null;
  if (!contextMenu && showNewFile) return <NewFileDialog open={showNewFile} onClose={() => setShowNewFile(false)} parentPath={newFileParent} />;
  if (!contextMenu) return null;

  const { x, y, node } = contextMenu;

  const handleRun = async () => {
    close();
    const tab = node.type === "file" ? { id: node.id, name: node.name, path: node.path, language: node.language || "plaintext", content: node.content || "", isDirty: false } : null;
    await runWorkspace({ activeTab: tab, fileTree: node.type === "folder" ? [node] : fileTree, addTerminalLine, setPreviewUrl, setActivePanel, setTerminalType });
  };

  const handleRunner = (runner: "node" | "python" | "bash") => {
    setTerminalType(runner === "python" ? "python" : runner === "node" ? "node" : "bash");
    setActivePanel("terminal");
    addTerminalLine({ text: `Workspace: ${node.path}`, type: "info" });
    addTerminalLine({ text: runner === "node" ? "setup: npm install && npm run dev" : runner === "python" ? "setup: python main.py" : "setup: bash script.sh", type: "output" });
    close();
  };

  const handleNewFile = () => {
    setNewFileParent(node.type === "folder" ? node.path : "");
    setShowNewFile(true);
    close();
  };

  const handleShare = async () => {
    try {
      if (node.type === "file") await shareTextOrDownload(node.name, node.content || "");
      else await shareBlobOrDownload(`${node.name}.zip`, await nodeToZipBlob(node));
      addTerminalLine({ text: `Shared ${node.name}`, type: "success" });
    } catch (error) {
      addTerminalLine({ text: `Share failed: ${error instanceof Error ? error.message : String(error)}`, type: "error" });
    }
    close();
  };

  const items = [
    ...(node.type === "file" ? [{ label: "Open", icon: FileText, action: () => { openFile(node); close(); } }] : []),
    { label: node.type === "file" ? "Run / Preview" : "Open via Runner", icon: Play, action: handleRun },
    ...(node.type === "folder" ? [
      { label: "Open via Node.js", icon: TerminalSquare, action: () => handleRunner("node") },
      { label: "Open via Python", icon: TerminalSquare, action: () => handleRunner("python") },
      { label: "Open via Bash", icon: TerminalSquare, action: () => handleRunner("bash") },
      { label: "New Here", icon: FilePlus, action: handleNewFile },
    ] : []),
    { label: "Share", icon: Share2, action: handleShare },
    { label: "Rename", icon: PencilLine, action: () => { setNewName(node.name); setRenaming(true); } },
    ...(node.type === "file" ? [{ label: "Copy Content", icon: Copy, action: () => { navigator.clipboard.writeText(node.content || ""); close(); } }] : []),
    { label: "Properties", icon: Info, action: () => {
      const size = node.content ? new Blob([node.content]).size : 0;
      const ext = node.name.split(".").pop() || "folder";
      addTerminalLine({ text: `--- Properties: ${node.name} ---`, type: "info" });
      addTerminalLine({ text: `Type: ${node.type === "folder" ? "Folder" : ext.toUpperCase() + " File"}`, type: "output" });
      addTerminalLine({ text: `Path: ${node.path}`, type: "output" });
      if (node.type === "file") {
        addTerminalLine({ text: `Size: ${size} bytes`, type: "output" });
        addTerminalLine({ text: `Lines: ${(node.content || "").split("\n").length}`, type: "output" });
      }
      if (node.type === "folder" && node.children) addTerminalLine({ text: `Items: ${node.children.length}`, type: "output" });
      setActivePanel("terminal");
      close();
    }},
    { label: "Delete", icon: Trash2, action: () => { deleteFileNode(node.path); close(); }, danger: true },
  ];

  return (
    <>
      <div className="fixed inset-0 z-50" onClick={close}>
        <div
          className="absolute bg-popover border border-border rounded-md shadow-2xl py-1 min-w-[190px] animate-fade-in max-h-[80vh] overflow-y-auto scrollbar-thin"
          style={{ left: Math.min(x, window.innerWidth - 210), top: Math.min(y, window.innerHeight - 360) }}
          onClick={(e) => e.stopPropagation()}
        >
          {renaming ? (
            <div className="px-3 py-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full bg-secondary text-xs text-foreground px-2.5 py-1.5 rounded outline-none focus:ring-1 focus:ring-primary"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newName.trim()) {
                    useIDEStore.getState().renameFileNode(node.path, newName);
                    close();
                  }
                  if (e.key === "Escape") close();
                }}
              />
            </div>
          ) : items.map((item, i) => (
            <button key={i} onClick={item.action} className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors ${(item as any).danger ? "text-destructive hover:bg-destructive/10" : "text-popover-foreground hover:bg-accent"}`}>
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          ))}
        </div>
      </div>
      {showNewFile && <NewFileDialog open={showNewFile} onClose={() => setShowNewFile(false)} parentPath={newFileParent} />}
    </>
  );
}

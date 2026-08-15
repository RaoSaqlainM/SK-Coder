import { useState, useCallback } from "react";
import {
  ChevronRight, ChevronDown, File, Folder, FolderOpen,
  FileCode, FileText, Image, Database, Braces, Globe, Palette,
  Search, FilePlus, MoreVertical
} from "lucide-react";
import { useIDEStore } from "@/store/ideStore";
import type { FileNode } from "@/types/ide";
import { cn } from "@/lib/utils";
import NewFileDialog from "./NewFileDialog";
import { filesFromDataTransfer } from "@/lib/importProject";

function getFileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, React.ReactNode> = {
    html: <Globe className="w-4 h-4 text-orange-400" />,
    css: <Palette className="w-4 h-4 text-blue-400" />,
    scss: <Palette className="w-4 h-4 text-pink-400" />,
    sass: <Palette className="w-4 h-4 text-pink-400" />,
    less: <Palette className="w-4 h-4 text-blue-300" />,
    js: <FileCode className="w-4 h-4 text-yellow-400" />,
    jsx: <FileCode className="w-4 h-4 text-yellow-400" />,
    ts: <FileCode className="w-4 h-4 text-blue-500" />,
    tsx: <FileCode className="w-4 h-4 text-blue-500" />,
    json: <Braces className="w-4 h-4 text-yellow-300" />,
    md: <FileText className="w-4 h-4 text-foreground" />,
    py: <FileCode className="w-4 h-4 text-green-400" />,
    sql: <Database className="w-4 h-4 text-blue-300" />,
    png: <Image className="w-4 h-4 text-green-300" />,
    jpg: <Image className="w-4 h-4 text-green-300" />,
    jpeg: <Image className="w-4 h-4 text-green-300" />,
    svg: <Image className="w-4 h-4 text-orange-300" />,
    gif: <Image className="w-4 h-4 text-purple-300" />,
    cpp: <FileCode className="w-4 h-4 text-blue-600" />,
    c: <FileCode className="w-4 h-4 text-blue-600" />,
    cs: <FileCode className="w-4 h-4 text-purple-500" />,
    java: <FileCode className="w-4 h-4 text-red-400" />,
    go: <FileCode className="w-4 h-4 text-cyan-400" />,
    rs: <FileCode className="w-4 h-4 text-orange-500" />,
    rb: <FileCode className="w-4 h-4 text-red-500" />,
    php: <FileCode className="w-4 h-4 text-indigo-400" />,
    swift: <FileCode className="w-4 h-4 text-orange-400" />,
    kt: <FileCode className="w-4 h-4 text-purple-400" />,
    dart: <FileCode className="w-4 h-4 text-cyan-500" />,
    vue: <FileCode className="w-4 h-4 text-green-500" />,
    svelte: <FileCode className="w-4 h-4 text-orange-600" />,
    yaml: <FileText className="w-4 h-4 text-red-300" />,
    yml: <FileText className="w-4 h-4 text-red-300" />,
    xml: <FileCode className="w-4 h-4 text-orange-300" />,
    sh: <FileCode className="w-4 h-4 text-green-300" />,
    env: <FileText className="w-4 h-4 text-yellow-600" />,
    toml: <FileText className="w-4 h-4 text-gray-400" />,
  };
  return map[ext] || <File className="w-4 h-4 text-muted-foreground" />;
}

function TreeItem({ node, depth = 0 }: { node: FileNode; depth?: number }) {
  const { openFile, activeTabId, openTabs, setContextMenu, expandedFolders, toggleFolder } = useIDEStore();
  const isActive = openTabs.find((t) => t.id === activeTabId)?.path === node.path;
  const isExpanded = expandedFolders.has(node.path);

  const handleClick = useCallback(() => {
    if (node.type === "folder") {
      toggleFolder(node.path);
    } else {
      openFile(node);
    }
  }, [node, toggleFolder, openFile]);

  const longPressRef = useState<{ timer: ReturnType<typeof setTimeout> | null }>({ timer: null })[0];

  const handleContextMenu = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const clientX = "clientX" in e ? e.clientX : e.touches[0].clientX;
    const clientY = "clientY" in e ? e.clientY : e.touches[0].clientY;
    setContextMenu({ x: clientX, y: clientY, node });
  }, [node, setContextMenu]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    longPressRef.timer = setTimeout(() => {
      setContextMenu({ x: touch.clientX, y: touch.clientY, node });
    }, 500);
  }, [longPressRef, node, setContextMenu]);

  const handleTouchEnd = useCallback(() => {
    if (longPressRef.timer) clearTimeout(longPressRef.timer);
    longPressRef.timer = null;
  }, [longPressRef]);

  return (
    <div>
      <div
        className={cn(
          "flex min-h-11 items-center gap-1.5 px-2 cursor-pointer text-[13px] transition-colors select-none",
          isActive
            ? "bg-accent/30 text-foreground"
            : "text-sidebar-foreground hover:bg-secondary/40"
        )}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchEnd}
      >
        {node.type === "folder" ? (
          <>
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            )}
            {isExpanded ? (
              <FolderOpen className="w-4 h-4 text-primary shrink-0" />
            ) : (
              <Folder className="w-4 h-4 text-primary/80 shrink-0" />
            )}
          </>
        ) : (
          <>
            <span className="w-3.5 shrink-0" />
            {getFileIcon(node.name)}
          </>
        )}
        <span className="min-w-0 flex-1 truncate">{node.name}</span>
        <button
          type="button"
          aria-label={`Open actions for ${node.name}`}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-sidebar-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            const rect = event.currentTarget.getBoundingClientRect();
            setContextMenu({ x: rect.right, y: rect.bottom, node });
          }}
          onTouchStart={(event) => event.stopPropagation()}
        >
          <MoreVertical className="h-3.5 w-3.5" />
        </button>
      </div>
      {node.type === "folder" && isExpanded && node.children && (
        <div>
          {[...node.children]
            .sort((a, b) => {
              if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
              return a.name.localeCompare(b.name);
            })
            .map((child) => (
              <TreeItem key={child.id} node={child} depth={depth + 1} />
            ))}
        </div>
      )}
    </div>
  );
}

export default function FileExplorer() {
  const { fileTree, searchQuery, setSearchQuery } = useIDEStore();
  const [showNewFile, setShowNewFile] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const filterTree = useCallback((nodes: FileNode[], query: string): FileNode[] => {
    if (!query) return nodes;
    return nodes
      .map((node) => {
        if (node.type === "folder" && node.children) {
          const filtered = filterTree(node.children, query);
          if (filtered.length > 0) return { ...node, children: filtered };
        }
        if (node.name.toLowerCase().includes(query.toLowerCase())) return node;
        return null;
      })
      .filter(Boolean) as FileNode[];
  }, []);

  const displayTree = searchQuery ? filterTree(fileTree, searchQuery) : fileTree;

  return (
    <div className="h-full flex flex-col bg-sidebar" onDragEnter={(event) => { event.preventDefault(); setDragOver(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={(event) => { if (event.currentTarget === event.target) setDragOver(false); }} onDrop={(event) => { event.preventDefault(); setDragOver(false); void filesFromDataTransfer(event.dataTransfer).then((files) => { if (files.length) document.dispatchEvent(new CustomEvent("sk-coder-import", { detail: files })); }); }}>
        <div className="flex min-h-11 items-center justify-between px-3 border-b border-sidebar-border shrink-0">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Explorer</span>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="flex h-11 w-11 items-center justify-center rounded hover:bg-sidebar-accent transition-colors"
          >
            <Search className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
          <button
            onClick={() => setShowNewFile(true)}
            className="flex h-11 w-11 items-center justify-center rounded hover:bg-sidebar-accent transition-colors"
          >
            <FilePlus className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>
      {showSearch && (
        <div className="px-2 py-1.5 border-b border-sidebar-border">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search files..."
            className="w-full bg-sidebar-accent text-xs text-foreground px-2.5 py-1.5 rounded outline-none placeholder:text-muted-foreground/50 focus:ring-1 focus:ring-primary"
            autoFocus
          />
        </div>
      )}
      <div className={`flex-1 overflow-y-auto scrollbar-thin py-0.5 ${dragOver ? "ring-2 ring-inset ring-primary bg-primary/5" : ""}`}>
        {displayTree.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-xs px-4 text-center gap-3 py-8">
            <Folder className="w-10 h-10 opacity-30" />
            <p className="font-medium">No files yet</p>
            <p className="text-[11px] opacity-70">Open, drop a project, or create a new file</p>
          </div>
        ) : (
          displayTree
            .sort((a, b) => {
              if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
              return a.name.localeCompare(b.name);
            })
            .map((node) => <TreeItem key={node.id} node={node} depth={0} />)
        )}
      </div>
      <NewFileDialog open={showNewFile} onClose={() => setShowNewFile(false)} parentPath="" />
    </div>
  );
}

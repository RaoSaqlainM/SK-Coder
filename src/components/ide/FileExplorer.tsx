import { useRef, useState, useMemo } from "react"
import { useIDEStore } from "@/store/ideStore"
import { importFromZip, importFromFiles } from "@/lib/importProject"
import type { FileNode } from "@/types/ide"
import { toast } from "sonner"

const EXT_COLORS: Record<string, string> = {
  html: "#e34c26", htm: "#e34c26", css: "#264de4", scss: "#cc6699", sass: "#cc6699",
  js: "#f7df1e", jsx: "#61dafb", ts: "#3178c6", tsx: "#3178c6",
  py: "#3572a5", cpp: "#00599c", c: "#555555", java: "#b07219",
  kt: "#7f52ff", rs: "#dea584", go: "#00add8", rb: "#cc342d",
  php: "#4f5d95", swift: "#ffac45", dart: "#00b4ab",
  md: "#083fa1", json: "#cbcb41", yaml: "#cb171e", yml: "#cb171e",
  xml: "#e37933", sh: "#4eaa25", sql: "#e38c00",
  vue: "#42b883", svelte: "#ff3e00",
}

function countByExt(nodes: FileNode[]): Record<string, number> {
  const counts: Record<string, number> = {}
  function walk(ns: FileNode[]) {
    for (const n of ns) {
      if (n.type === "file") {
        const ext = n.name.split(".").pop()?.toLowerCase() || "other"
        counts[ext] = (counts[ext] || 0) + 1
      }
      if (n.children) walk(n.children)
    }
  }
  walk(nodes)
  return counts
}

function LangStats({ nodes }: { nodes: FileNode[] }) {
  const stats = useMemo(() => {
    const counts = countByExt(nodes)
    const total = Object.values(counts).reduce((a, b) => a + b, 0)
    if (total === 0) return null
    const sorted = Object.entries(counts).sort(([, a], [, b]) => b - a).slice(0, 7)
    return { sorted, total }
  }, [nodes])

  if (!stats || stats.total === 0) return null

  return (
    <div className="lang-stats">
      <div className="lang-stats-bar">
        {stats.sorted.map(([ext, count]) => (
          <div
            key={ext}
            className="lang-stats-seg"
            style={{ width: `${(count / stats.total) * 100}%`, background: EXT_COLORS[ext] || "#888" }}
            title={`.${ext} — ${Math.round((count / stats.total) * 100)}%`}
          />
        ))}
      </div>
      <div className="lang-stats-list">
        {stats.sorted.map(([ext, count]) => (
          <span key={ext} className="lang-stat-item">
            <span style={{ color: EXT_COLORS[ext] || "#888" }}>●</span>
            <span>.{ext}</span>
            <span style={{ color: "var(--text-muted)" }}>{Math.round((count / stats.total) * 100)}%</span>
          </span>
        ))}
      </div>
    </div>
  )
}

function FileIcon({ node, expanded }: { node: FileNode; expanded?: boolean }) {
  if (node.type === "folder") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill={expanded ? "var(--accent)" : "#e8a853"} stroke="none">
        <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
      </svg>
    )
  }
  const ext = node.name.split(".").pop()?.toLowerCase() || ""
  const colors: Record<string, string> = {
    ...EXT_COLORS,
    h: "#555555", gitignore: "var(--text-muted)", env: "var(--orange)", toml: "var(--orange)",
    png: "#3d90ff", jpg: "#3d90ff", jpeg: "#3d90ff", gif: "#3d90ff", svg: "#ffb13b",
    txt: "var(--text-muted)", astro: "#ff5a03",
  }
  const color = colors[ext] || "var(--text-muted)"
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill={color} stroke="none">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" opacity="0.9"/>
      <polyline points="14 2 14 8 20 8" fill="rgba(0,0,0,0.2)" stroke="none"/>
    </svg>
  )
}

type FileNodeProps = { node: FileNode; depth: number; activePath: string | undefined }

function FileNodeItem({ node, depth, activePath }: FileNodeProps) {
  const {
    openTab, expandedFolders, toggleFolder, setContextMenu,
    renameNodeId, setRenameNodeId, renameNode, moveNode, setDragOver, dragOverId,
    setActivePanel, setSidebarOpen,
  } = useIDEStore()
  const [renameValue, setRenameValue] = useState(node.name)
  const expanded = expandedFolders.has(node.path)

  function handleClick() {
    if (node.type === "folder") {
      toggleFolder(node.path)
    } else {
      openTab(node)
      if (window.innerWidth < 768) {
        setSidebarOpen(false)
        setActivePanel("editor")
      }
    }
  }

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, node, isFolder: node.type === "folder" })
  }

  function handleRenameKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      if (renameValue.trim() && renameValue !== node.name) renameNode(node.path, renameValue.trim())
      else setRenameNodeId(null)
    }
    if (e.key === "Escape") { setRenameNodeId(null); setRenameValue(node.name) }
  }

  function handleDragStart(e: React.DragEvent) {
    e.dataTransfer.setData("text/plain", node.path)
    e.dataTransfer.effectAllowed = "move"
  }

  function handleDragOver(e: React.DragEvent) {
    if (node.type !== "folder") return
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    setDragOver(node.id)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(null)
    if (node.type !== "folder") return
    const fromPath = e.dataTransfer.getData("text/plain")
    if (!fromPath || fromPath === node.path || node.path.startsWith(fromPath + "/")) return
    moveNode(fromPath, node.path)
    toast.success("Moved")
  }

  const isActive = activePath === node.path
  const isRenaming = renameNodeId === node.id
  const isDragOver = dragOverId === node.id

  return (
    <>
      <div
        className={`file-node ${isActive ? "active" : ""} ${isDragOver ? "drag-over" : ""}`}
        style={{ paddingLeft: `${0.4 + depth * 1}rem` }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        draggable
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={() => setDragOver(null)}
        onDrop={handleDrop}
        title={node.path}
      >
        {node.type === "folder" && (
          <svg
            className={`file-node-chevron ${expanded ? "open" : ""}`}
            width="9" height="9" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2.5"
          >
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        )}
        <span className="file-node-icon"><FileIcon node={node} expanded={expanded} /></span>
        {isRenaming ? (
          <div className="file-node-rename" onClick={(e) => e.stopPropagation()}>
            <input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={handleRenameKeyDown}
              onBlur={() => setRenameNodeId(null)}
              autoFocus
            />
          </div>
        ) : (
          <span className="file-node-name">{node.name}</span>
        )}
      </div>
      {node.type === "folder" && expanded && node.children && (
        <>
          {node.children.map((child) => (
            <FileNodeItem key={child.id} node={child} depth={depth + 1} activePath={activePath} />
          ))}
        </>
      )}
    </>
  )
}

export default function FileExplorer() {
  const { fileTree, setNewItem, importFiles, getActiveFile } = useIDEStore()
  const importInputRef = useRef<HTMLInputElement>(null)
  const [dragActive, setDragActive] = useState(false)
  const [search, setSearch] = useState("")
  const activeFile = getActiveFile()

  async function handleSmartImport(files: FileList) {
    if (!files.length) return
    const zipFile = Array.from(files).find((f) => f.name.toLowerCase().endsWith(".zip"))
    try {
      if (zipFile) {
        const nodes = await importFromZip(zipFile)
        importFiles(nodes)
        toast.success(`Imported ${zipFile.name}`)
      } else {
        const nodes = await importFromFiles(files)
        importFiles(nodes)
        toast.success(`Imported ${files.length} file(s)`)
      }
    } catch {
      toast.error("Import failed")
    }
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragActive(false)
    const files = e.dataTransfer.files
    if (!files.length) return
    await handleSmartImport(files)
  }

  function filterTree(nodes: FileNode[], query: string): FileNode[] {
    if (!query) return nodes
    const q = query.toLowerCase()
    const results: FileNode[] = []
    function walk(ns: FileNode[]) {
      for (const n of ns) {
        if (n.type === "file" && n.name.toLowerCase().includes(q)) results.push(n)
        if (n.children) walk(n.children)
      }
    }
    walk(nodes)
    return results
  }

  const displayTree = search ? filterTree(fileTree, search) : fileTree

  return (
    <div
      className="file-explorer"
      onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
      onDragLeave={() => setDragActive(false)}
      onDrop={handleDrop}
    >
      <div className="file-explorer-header">
        <span>Explorer</span>
        <div className="file-explorer-actions">
          <button className="file-explorer-action-btn" onClick={() => setNewItem(null, "file")} title="New File">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>
            </svg>
          </button>
          <button className="file-explorer-action-btn" onClick={() => setNewItem(null, "folder")} title="New Folder">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              <line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/>
            </svg>
          </button>
          <button className="file-explorer-action-btn" onClick={() => importInputRef.current?.click()} title="Import files or ZIP">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
          </button>
        </div>
      </div>

      <div className="file-explorer-search">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search files..." style={{ width: "100%" }} />
      </div>

      <div className="file-tree">
        {dragActive && <div className="import-drop-zone drag-active" style={{ margin: "0.5rem" }}>Drop ZIP or files here</div>}

        {displayTree.length === 0 && !dragActive && (
          <div className="panel-placeholder" style={{ padding: "1.5rem" }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
            <p>{search ? "No files match" : "Drop files here or click +"}</p>
            {!search && (
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem", flexWrap: "wrap", justifyContent: "center" }}>
                <button className="btn btn-secondary" onClick={() => setNewItem(null, "file")}>+ New File</button>
                <button className="btn btn-ghost" onClick={() => importInputRef.current?.click()}>Import</button>
              </div>
            )}
          </div>
        )}

        {search
          ? displayTree.map((node) => <FileNodeItem key={node.id} node={node} depth={0} activePath={activeFile?.path} />)
          : fileTree.map((node) => <FileNodeItem key={node.id} node={node} depth={0} activePath={activeFile?.path} />)
        }
      </div>

      <LangStats nodes={fileTree} />

      <input
        ref={importInputRef}
        type="file"
        multiple
        style={{ display: "none" }}
        onChange={async (e) => { if (e.target.files) await handleSmartImport(e.target.files); e.target.value = "" }}
      />
    </div>
  )
}

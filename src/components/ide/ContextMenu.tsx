import { useEffect, useRef } from "react"
import { useIDEStore } from "@/store/ideStore"
import { exportToZip, downloadBlob } from "@/lib/importProject"
import { buildPreview } from "@/lib/previewBuilder"
import { toast } from "sonner"

type OpenDestination = "shell" | "python" | "nodejs" | "java" | "ai" | "preview"

function MenuIcon({ type }: { type: "file" | "folder" | "terminal" | "python" | "node" | "java" | "ai" | "preview" | "edit" | "copy" | "download" | "trash" | "plus" }) {
  const common = { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const }
  if (type === "terminal") return <svg {...common}><polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" /></svg>
  if (type === "python") return <svg {...common}><path d="M12 2c-4 0-6 2-6 5v3h6v1H5c-2 0-3 1-3 3s1 3 3 3h2v2c0 2 2 3 5 3s5-1 5-3v-2h2c2 0 3-1 3-3s-1-3-3-3h-1V7c0-3-2-5-6-5Z" /><circle cx="9" cy="6" r=".7" fill="currentColor" stroke="none" /><circle cx="15" cy="18" r=".7" fill="currentColor" stroke="none" /></svg>
  if (type === "node") return <svg {...common}><path d="m12 3 9 5v8l-9 5-9-5V8l9-5Z" /><path d="m7 10 5 3 5-3M12 13v8" /></svg>
  if (type === "java") return <svg {...common}><path d="M8 17h8M7 20h10" /><path d="M10 4c3 2-2 3 1 5 2 1 2 2 1 3M15 3c3 2-2 4 1 6" /><path d="M6 14c2-1 10-1 12 0-1 2-11 2-12 0Z" /></svg>
  if (type === "ai") return <svg {...common}><path d="M12 3a3 3 0 0 1 3 3v1h1a6 6 0 0 1 6 6v1H2v-1a6 6 0 0 1 6-6h1V6a3 3 0 0 1 3-3Z" /><rect x="3" y="14" width="18" height="7" rx="2" /><circle cx="8" cy="17.5" r="1" fill="currentColor" stroke="none" /><circle cx="16" cy="17.5" r="1" fill="currentColor" stroke="none" /></svg>
  if (type === "preview") return <svg {...common}><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></svg>
  if (type === "folder") return <svg {...common}><path d="M3 6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Z" /></svg>
  if (type === "plus") return <svg {...common}><path d="M12 5v14M5 12h14" /></svg>
  if (type === "edit") return <svg {...common}><path d="m4 16-1 5 5-1L20 8a2.1 2.1 0 0 0-3-3L5 19" /><path d="m14 6 4 4" /></svg>
  if (type === "copy") return <svg {...common}><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></svg>
  if (type === "download") return <svg {...common}><path d="M12 3v12M7 10l5 5 5-5M5 21h14" /></svg>
  if (type === "trash") return <svg {...common}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3" /></svg>
  if (type === "file") return <svg {...common}><path d="M6 3h8l4 4v14H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" /><path d="M14 3v5h5" /></svg>
  return <svg {...common}><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" /><path d="M14 3v6h6" /></svg>
}

const destinationMeta: Record<OpenDestination, { label: string; hint: string; icon: Parameters<typeof MenuIcon>[0]["type"]; color: string }> = {
  shell: { label: "SK-Terminal", hint: "Open working directory", icon: "terminal", color: "var(--green)" },
  python: { label: "Python", hint: "Run with Python 3", icon: "python", color: "#6fb7e9" },
  nodejs: { label: "Node.js", hint: "Run with Node.js", icon: "node", color: "#8ccf83" },
  java: { label: "Java", hint: "Run with Java", icon: "java", color: "#e0a56a" },
  ai: { label: "SK-AI", hint: "Ask about this file", icon: "ai", color: "var(--purple)" },
  preview: { label: "Preview", hint: "Open live browser preview", icon: "preview", color: "var(--accent)" },
}

export default function ContextMenu() {
  const {
    contextMenu, setContextMenu, deleteNode, setRenameNodeId,
    setNewItem, openTab, fileTree, setActivePanel, refreshPreview, setPreviewContent,
    openInTerminal, setTerminalBridgeCmd,
  } = useIDEStore()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setContextMenu(null)
    }
    document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [setContextMenu])

  if (!contextMenu) return null

  const { x, y, node, isFolder } = contextMenu
  const ext = node?.type === "file" ? (node.name.split(".").pop()?.toLowerCase() || "") : ""
  const isHtml = ["html", "htm"].includes(ext)
  const isPython = ext === "py"
  const isNode = ["js", "jsx", "ts", "tsx", "mjs", "cjs"].includes(ext)
  const isJava = ext === "java"
  const menuLeft = Math.max(8, Math.min(x, window.innerWidth - 286))
  const menuTop = Math.max(8, Math.min(y, window.innerHeight - (isFolder ? 430 : 510)))

  function closeMenu() {
    setContextMenu(null)
  }

  async function handleExport() {
    if (!node) return
    if (node.type === "file") {
      downloadBlob(new Blob([node.content || ""], { type: "text/plain" }), node.name)
      toast.success(`Downloaded ${node.name}`)
    } else {
      const blob = await exportToZip([node])
      downloadBlob(blob, node.name + ".zip")
      toast.success(`Exported ${node.name}.zip`)
    }
    closeMenu()
  }

  function handleCopyPath() {
    if (!node) return
    navigator.clipboard.writeText(node.path)
    toast.success("Path copied")
    closeMenu()
  }

  function handleCopyContent() {
    if (!node || node.type !== "file") return
    navigator.clipboard.writeText(node.content || "")
    toast.success("Content copied")
    closeMenu()
  }

  function handleDelete() {
    if (!node) return
    if (confirm(`Delete "${node.name}"?`)) {
      deleteNode(node.path)
      toast.success(`Deleted ${node.name}`)
    }
    closeMenu()
  }

  function handleOpenDestination(destination: OpenDestination) {
    if (!node) return
    if (destination === "shell") {
      openInTerminal(node.path, node.type === "folder")
      closeMenu()
      return
    }
    if (destination === "preview") {
      if (node.type !== "file") return
      const html = buildPreview(fileTree, node.path)
      setPreviewContent(html)
      refreshPreview()
      setActivePanel("preview")
      closeMenu()
      toast.success("Preview updated")
      return
    }
    const cwd = node.type === "folder"
      ? node.path
      : node.path.substring(0, node.path.lastIndexOf("/")) || "/"
    if (node.type === "file") openTab(node)
    setActivePanel("terminal")
    setTerminalBridgeCmd({
      cmd: node.type === "folder"
        ? ""
        : destination === "ai"
        ? `Review ${node.path}`
        : `run ${node.name}`,
      targetTab: destination,
      cwd,
    })
    closeMenu()
  }

  function handleOpenEditor() {
    if (!node || node.type !== "file") return
    openTab(node)
    closeMenu()
  }

  function handleNewFile() {
    setNewItem(isFolder ? node?.id || null : null, "file")
    closeMenu()
  }

  function handleNewFolder() {
    setNewItem(isFolder ? node?.id || null : null, "folder")
    closeMenu()
  }

  function handleRename() {
    if (!node) return
    setRenameNodeId(node.id)
    closeMenu()
  }

  const destinations: OpenDestination[] = ["shell", "python", "nodejs", "java", "ai"]
  if (isHtml) destinations.push("preview")

  return (
    <div className="context-menu" ref={ref} style={{ left: menuLeft, top: menuTop }}>
      <div className="context-menu-heading">
        <span className="context-menu-heading-icon"><MenuIcon type={isFolder ? "folder" : "file"} /></span>
        <span className="context-menu-heading-copy">
          <strong>{node?.name || "Workspace"}</strong>
          <small>{isFolder ? "Folder actions" : "File actions"}</small>
        </span>
      </div>

      <div className="context-menu-section-label">Open in</div>
      <div className="context-menu-destinations">
        {destinations.map((destination) => {
          const meta = destinationMeta[destination]
          const available = destination === "shell" || destination === "ai" || (destination === "preview" ? isHtml : destination === "python" ? isPython : destination === "nodejs" ? isNode : isJava)
          return (
            <button
              type="button"
              key={destination}
              className={`context-menu-destination ${available ? "" : "is-disabled"}`}
              onClick={() => available && handleOpenDestination(destination)}
              disabled={!available}
              title={available ? meta.hint : `Not available for .${ext || "folder"}`}
            >
              <span className="context-menu-destination-icon" style={{ color: meta.color }}><MenuIcon type={meta.icon} /></span>
              <span className="context-menu-destination-copy">
                <strong>{meta.label}</strong>
                <small>{available ? meta.hint : `Not available for .${ext || "folder"}`}</small>
              </span>
              {available && <span className="context-menu-arrow">↗</span>}
            </button>
          )
        })}
      </div>

      {node?.type === "file" && (
        <button type="button" className="context-menu-item" onClick={handleOpenEditor}>
          <MenuIcon type="file" />
          <span>Open in Editor</span>
        </button>
      )}

      {isFolder && (
        <>
          <div className="context-menu-divider" />
          <div className="context-menu-section-label">Create</div>
          <button type="button" className="context-menu-item" onClick={handleNewFile}>
            <MenuIcon type="plus" />
            <span>New File</span>
          </button>
          <button type="button" className="context-menu-item" onClick={handleNewFolder}>
            <MenuIcon type="folder" />
            <span>New Folder</span>
          </button>
        </>
      )}

      <div className="context-menu-divider" />
      <button type="button" className="context-menu-item" onClick={handleRename}>
        <MenuIcon type="edit" />
        <span>Rename</span>
      </button>
      <button type="button" className="context-menu-item" onClick={handleCopyPath}>
        <MenuIcon type="copy" />
        <span>Copy Path</span>
      </button>
      {node?.type === "file" && (
        <button type="button" className="context-menu-item" onClick={handleCopyContent}>
          <MenuIcon type="copy" />
          <span>Copy Content</span>
        </button>
      )}
      <button type="button" className="context-menu-item" onClick={handleExport}>
        <MenuIcon type="download" />
        <span>Download</span>
      </button>
      <div className="context-menu-divider" />
      <button type="button" className="context-menu-item danger" onClick={handleDelete}>
        <MenuIcon type="trash" />
        <span>Delete</span>
      </button>
    </div>
  )
}
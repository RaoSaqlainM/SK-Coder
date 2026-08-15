import { useState, useRef, useCallback, useEffect } from "react"
import { toast } from "sonner"

interface ApkFile {
  name: string
  path: string
  size: number
  isText: boolean
  isDir: boolean
}

interface ZipEntry {
  async: (type: "string" | "uint8array") => Promise<string | Uint8Array>
  _data?: { uncompressedSize?: number; compressedSize?: number }
}

interface ZipInstance {
  file(n: string): ZipEntry | null | undefined
  file(n: string, content: string | Uint8Array): void
  generateAsync(opts: unknown): Promise<Blob>
  forEach(cb: (path: string, entry: { dir: boolean; _data?: { uncompressedSize?: number } }) => void): void
}

const TEXT_EXTS = new Set([
  "xml", "txt", "json", "properties", "mf", "sf", "smali", "gradle",
  "kt", "java", "py", "js", "html", "css", "md", "toml", "yaml", "yml",
  "sh", "bat", "cfg", "conf", "ini", "pro", "pgcfg",
])

function isTextFile(name: string): boolean {
  const ext = name.split(".").pop()?.toLowerCase() ?? ""
  return TEXT_EXTS.has(ext)
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

async function createJSZip(): Promise<new () => ZipInstance & { loadAsync: (data: ArrayBuffer) => Promise<ZipInstance> }> {
  const mod = await import("jszip")
  return ((mod as unknown as { default: unknown }).default ?? mod) as new () => ZipInstance & { loadAsync: (data: ArrayBuffer) => Promise<ZipInstance> }
}

function ApkIcon({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8">
      <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
      <path d="M12 18h.01"/>
      <path d="M9 6h6"/>
      <path d="M9 10h6"/>
      <path d="M9 14h4"/>
    </svg>
  )
}

function AndroidIcon({ size = 14, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none">
      <path d="M17.523 15.341a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-11.046 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM15.65 4.826l1.521-2.634a.5.5 0 0 0-.866-.5l-1.54 2.668A8.943 8.943 0 0 0 12 4c-.96 0-1.882.156-2.742.434L7.695 1.692a.5.5 0 0 0-.866.5L8.35 4.826C5.84 6.124 4 8.617 4 11.5h16c0-2.883-1.84-5.376-4.35-6.674z"/>
    </svg>
  )
}

function getFileIcon(path: string, isText: boolean): string {
  const lower = path.toLowerCase()
  if (lower.endsWith(".xml")) return "📋"
  if (lower.endsWith(".smali")) return "⚙"
  if (lower.endsWith(".dex")) return "◈"
  if (lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".webp") || lower.endsWith(".gif")) return "🖼"
  if (lower.endsWith(".so")) return "⬡"
  if (lower.endsWith(".jar") || lower.endsWith(".aar")) return "📦"
  if (lower.endsWith(".json")) return "{ }"
  if (lower.endsWith(".kotlin_module") || lower.endsWith(".kt")) return "K"
  if (lower.endsWith(".java")) return "J"
  if (lower.endsWith(".arsc")) return "R"
  if (lower.endsWith(".mf") || lower.endsWith(".sf") || lower.endsWith(".rsa") || lower.endsWith(".dsa")) return "🔑"
  if (isText) return "📄"
  return "⬜"
}

function buildFolderTree(files: ApkFile[]): Map<string, ApkFile[]> {
  const tree = new Map<string, ApkFile[]>()
  tree.set("", [])
  for (const f of files) {
    const parts = f.path.split("/")
    for (let i = 1; i < parts.length; i++) {
      const parent = parts.slice(0, i).join("/")
      if (!tree.has(parent)) tree.set(parent, [])
    }
    const parent = parts.slice(0, -1).join("/")
    const arr = tree.get(parent) ?? []
    arr.push(f)
    tree.set(parent, arr)
  }
  return tree
}

function FolderRow({
  path, depth, expanded, onToggle, children,
}: {
  path: string; depth: number; expanded: boolean; onToggle: () => void; children: React.ReactNode
}) {
  const name = path.split("/").pop() || path
  return (
    <div>
      <div
        onClick={onToggle}
        style={{
          display: "flex", alignItems: "center", gap: "0.3rem",
          padding: "0.25rem 0.4rem", paddingLeft: `${0.4 + depth * 0.9}rem`,
          cursor: "pointer", userSelect: "none",
          color: "var(--text-secondary)", fontSize: 11,
          background: "transparent",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <span style={{ fontSize: 10, width: 10, flexShrink: 0, color: "var(--text-muted)" }}>
          {expanded ? "▾" : "▸"}
        </span>
        <span style={{ fontSize: 12 }}>📁</span>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
      </div>
      {expanded && <div>{children}</div>}
    </div>
  )
}

export default function ApkEditor() {
  const [files, setFiles] = useState<ApkFile[]>([])
  const [selected, setSelected] = useState<ApkFile | null>(null)
  const [editContent, setEditContent] = useState("")
  const [apkName, setApkName] = useState("")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [zipRef, setZipRef] = useState<{ zip: ZipInstance } | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["", "META-INF", "res"]))
  const [search, setSearch] = useState("")
  const [modified, setModified] = useState<Set<string>>(new Set())
  const inputRef = useRef<HTMLInputElement>(null)

  const folderTree = buildFolderTree(files)

  function toggleFolder(path: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const loadApk = useCallback(async (file: File) => {
    setLoading(true)
    setModified(new Set())
    try {
      const JSZip = await createJSZip()
      const zip = new JSZip()
      const buf = await file.arrayBuffer()
      const loaded = await zip.loadAsync(buf)

      const apkFiles: ApkFile[] = []
      loaded.forEach((path, entry) => {
        if (!entry.dir) {
          apkFiles.push({
            name: path.split("/").pop() ?? path,
            path,
            size: entry._data?.uncompressedSize ?? 0,
            isText: isTextFile(path),
            isDir: false,
          })
        }
      })

      apkFiles.sort((a, b) => {
        const aDir = a.path.includes("/")
        const bDir = b.path.includes("/")
        if (aDir && !bDir) return -1
        if (!aDir && bDir) return 1
        return a.path.localeCompare(b.path)
      })

      setFiles(apkFiles)
      setApkName(file.name)
      setSelected(null)
      setEditContent("")
      setZipRef({ zip: loaded as ZipInstance })

      const rootFolders = new Set<string>([""])
      for (const f of apkFiles) {
        const parts = f.path.split("/")
        if (parts.length > 1) rootFolders.add(parts[0])
      }
      setExpanded(new Set(Array.from(rootFolders).slice(0, 6)))
      toast.success(`Loaded ${apkFiles.length} files from ${file.name}`)
    } catch (e) {
      toast.error(`Failed to open APK: ${String(e).slice(0, 80)}`)
    } finally {
      setLoading(false)
    }
  }, [])

  async function handleFileSelect(apkFile: ApkFile) {
    if (!zipRef) return
    setSelected(apkFile)
    if (!apkFile.isText) { setEditContent(""); return }
    try {
      const entry = zipRef.zip.file(apkFile.path)
      const content = entry ? (await entry.async("string")) as string : ""
      setEditContent(content)
    } catch {
      setEditContent("[Binary or unreadable file]")
    }
  }

  function saveEdit() {
    if (!selected || !zipRef) return
    setSaving(true)
    setTimeout(() => {
      zipRef.zip.file(selected.path, editContent)
      setModified((prev) => new Set([...prev, selected.path]))
      setSaving(false)
      toast.success(`Saved ${selected.name}`)
    }, 80)
  }

  async function repackage() {
    if (!zipRef) return
    setLoading(true)
    try {
      const blob = await zipRef.zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = apkName.replace(/\.(apk|zip)$/i, "_modified.apk")
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 5000)
      setModified(new Set())
      toast.success("Downloaded modified APK")
    } catch {
      toast.error("Failed to repackage APK")
    } finally {
      setLoading(false)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) loadApk(file)
  }

  function closeApk() {
    setFiles([])
    setSelected(null)
    setEditContent("")
    setApkName("")
    setZipRef(null)
    setModified(new Set())
  }

  const filteredFiles = search.trim()
    ? files.filter((f) => f.path.toLowerCase().includes(search.toLowerCase()))
    : null

  function renderTree(parentPath: string, depth: number): React.ReactNode {
    const children = folderTree.get(parentPath) ?? []
    const subFolders = new Set<string>()
    folderTree.forEach((_, key) => {
      if (key === parentPath) return
      const parts = key.split("/")
      if (parts.slice(0, -1).join("/") === parentPath) {
        subFolders.add(key)
      }
    })

    const folders = Array.from(subFolders).sort()

    return (
      <>
        {folders.map((folderPath) => {
          const isExp = expanded.has(folderPath)
          return (
            <FolderRow
              key={folderPath}
              path={folderPath}
              depth={depth}
              expanded={isExp}
              onToggle={() => toggleFolder(folderPath)}
            >
              {isExp && renderTree(folderPath, depth + 1)}
            </FolderRow>
          )
        })}
        {children.map((f) => (
          <div
            key={f.path}
            onClick={() => handleFileSelect(f)}
            style={{
              display: "flex", alignItems: "center", gap: "0.35rem",
              padding: "0.25rem 0.4rem",
              paddingLeft: `${0.4 + depth * 0.9 + 0.4}rem`,
              cursor: "pointer",
              background: selected?.path === f.path ? "var(--bg-active)" : "transparent",
              borderLeft: selected?.path === f.path ? "2px solid var(--accent)" : "2px solid transparent",
              fontSize: 11,
              color: "var(--text-primary)",
            }}
            onMouseEnter={(e) => { if (selected?.path !== f.path) e.currentTarget.style.background = "var(--bg-hover)" }}
            onMouseLeave={(e) => { if (selected?.path !== f.path) e.currentTarget.style.background = "transparent" }}
          >
            <span style={{ fontSize: 11, flexShrink: 0 }}>{getFileIcon(f.path, f.isText)}</span>
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {f.name}
            </span>
            {modified.has(f.path) && (
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--accent)", flexShrink: 0 }} />
            )}
          </div>
        ))}
      </>
    )
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--bg-primary)", overflow: "hidden" }}>
      <div style={{
        display: "flex", alignItems: "center", gap: "0.5rem",
        padding: "0.5rem 0.75rem", borderBottom: "1px solid var(--border)",
        background: "var(--bg-secondary)", flexShrink: 0,
      }}>
        <AndroidIcon size={15} color="#a6e3a1" />
        <span style={{ fontWeight: 700, fontSize: 12, color: "var(--text-primary)" }}>APK Editor</span>
        {apkName && (
          <span style={{ fontSize: 11, color: "var(--accent)", marginLeft: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 120 }}>
            {apkName}
          </span>
        )}
        {files.length > 0 && (
          <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
            {files.length} files{modified.size > 0 ? ` · ${modified.size} modified` : ""}
          </span>
        )}
        <div style={{ flex: 1 }} />
        {files.length > 0 && (
          <>
            <button
              className="btn btn-primary"
              onClick={repackage}
              disabled={loading}
              style={{ fontSize: 11, padding: "0.2rem 0.6rem", flexShrink: 0 }}
            >
              {loading ? "Packing..." : "↓ Repackage"}
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => inputRef.current?.click()}
              style={{ fontSize: 11, padding: "0.2rem 0.5rem", flexShrink: 0 }}
            >
              Open
            </button>
            <button
              className="btn btn-ghost"
              onClick={closeApk}
              style={{ fontSize: 11, padding: "0.2rem 0.4rem", color: "var(--text-muted)", flexShrink: 0 }}
              title="Close APK"
            >
              ✕
            </button>
          </>
        )}
        {files.length === 0 && (
          <button
            className="btn btn-primary"
            onClick={() => inputRef.current?.click()}
            style={{ fontSize: 11, padding: "0.2rem 0.6rem" }}
          >
            Open APK / ZIP
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".apk,.zip,.xapk,.apks"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) loadApk(f)
            e.target.value = ""
          }}
        />
      </div>

      {files.length === 0 ? (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          style={{
            flex: 1, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            gap: "1.25rem", cursor: "pointer", padding: "2rem",
          }}
          onClick={() => inputRef.current?.click()}
        >
          <div style={{ position: "relative" }}>
            <div style={{
              width: 72, height: 72, borderRadius: 18,
              background: "linear-gradient(135deg, #a6e3a1 0%, #007acc 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 8px 32px rgba(0,122,204,0.3)",
            }}>
              <AndroidIcon size={36} color="#fff" />
            </div>
            <div style={{
              position: "absolute", bottom: -4, right: -4,
              background: "var(--bg-elevated)", borderRadius: 8, padding: "2px 5px",
              border: "1px solid var(--border)", fontSize: 10, color: "var(--accent)",
              fontWeight: 600,
            }}>APK</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>
              {loading ? "Loading APK..." : "Open an APK File"}
            </p>
            <p style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.6 }}>
              Drag & drop or click to browse<br />
              Supports .apk · .xapk · .apks · .zip
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", justifyContent: "center", maxWidth: 320 }}>
            {["View AndroidManifest.xml", "Edit string resources", "Replace app icon", "Edit smali code", "Repackage & download"].map((f) => (
              <span key={f} style={{
                fontSize: 10, padding: "0.2rem 0.5rem", borderRadius: 4,
                background: "var(--bg-elevated)", color: "var(--text-secondary)",
                border: "1px solid var(--border)",
              }}>{f}</span>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: "flex", minHeight: 0, overflow: "hidden" }}>
          <div style={{ width: "38%", borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", minHeight: 0 }}>
            <div style={{ padding: "0.4rem 0.5rem", borderBottom: "1px solid var(--border-subtle)", flexShrink: 0 }}>
              <input
                type="text"
                placeholder="Search files..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ fontSize: 11, padding: "0.2rem 0.5rem" }}
              />
            </div>
            <div style={{ flex: 1, overflowY: "auto", fontFamily: "var(--font-mono)", fontSize: 11 }}>
              {filteredFiles ? (
                filteredFiles.length === 0 ? (
                  <div style={{ padding: "1rem", textAlign: "center", color: "var(--text-muted)", fontSize: 11 }}>No results</div>
                ) : filteredFiles.map((f) => (
                  <div
                    key={f.path}
                    onClick={() => handleFileSelect(f)}
                    style={{
                      display: "flex", alignItems: "center", gap: "0.35rem",
                      padding: "0.25rem 0.5rem",
                      cursor: "pointer",
                      background: selected?.path === f.path ? "var(--bg-active)" : "transparent",
                      fontSize: 11,
                    }}
                  >
                    <span style={{ fontSize: 11 }}>{getFileIcon(f.path, f.isText)}</span>
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.path}</span>
                    {modified.has(f.path) && <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--accent)" }} />}
                  </div>
                ))
              ) : (
                renderTree("", 0)
              )}
            </div>
          </div>

          <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
            {selected ? (
              <>
                <div style={{
                  display: "flex", alignItems: "center", gap: "0.5rem",
                  padding: "0.35rem 0.5rem", borderBottom: "1px solid var(--border-subtle)",
                  background: "var(--bg-secondary)", fontSize: 11, flexShrink: 0,
                }}>
                  <span style={{ fontSize: 11 }}>{getFileIcon(selected.path, selected.isText)}</span>
                  <span style={{ color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{selected.path}</span>
                  {selected.size > 0 && <span style={{ color: "var(--text-muted)", fontSize: 10, flexShrink: 0 }}>{humanSize(selected.size)}</span>}
                  {selected.isText && (
                    <button
                      className="btn btn-primary"
                      onClick={saveEdit}
                      disabled={saving}
                      style={{ fontSize: 10, padding: "0.15rem 0.5rem", flexShrink: 0 }}
                    >
                      {saving ? "Saving..." : "Save"}
                    </button>
                  )}
                </div>
                {selected.isText ? (
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    style={{
                      flex: 1, width: "100%", background: "var(--bg-primary)", color: "var(--text-primary)",
                      border: "none", outline: "none", padding: "0.6rem 0.75rem", resize: "none",
                      fontFamily: "var(--font-mono)", fontSize: 11.5, lineHeight: 1.7,
                    }}
                    spellCheck={false}
                  />
                ) : (
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.75rem", padding: "1rem" }}>
                    <span style={{ fontSize: 36 }}>{getFileIcon(selected.path, false)}</span>
                    <div style={{ textAlign: "center" }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>{selected.name}</p>
                      <p style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.6 }}>
                        Binary file — view only<br />
                        Cannot be edited as text
                      </p>
                      <p style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 6, opacity: 0.5 }}>{selected.path}</p>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.75rem" }}>
                <AndroidIcon size={32} color="var(--text-muted)" />
                <div style={{ textAlign: "center" }}>
                  <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Select a file to view or edit</p>
                  <p style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4, opacity: 0.6 }}>
                    Text files (XML, SMALI, JSON) are editable
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

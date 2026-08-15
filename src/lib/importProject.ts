import JSZip from "jszip"
import type { FileNode } from "../types/ide"

function generateId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

function getLanguage(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || ""
  const map: Record<string, string> = {
    ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
    py: "python", cpp: "cpp", c: "c", h: "cpp", html: "html", htm: "html",
    css: "css", scss: "scss", json: "json", yaml: "yaml", yml: "yaml",
    xml: "xml", md: "markdown", sh: "shell", java: "java", kt: "kotlin",
    rs: "rust", go: "go", rb: "ruby", php: "php", swift: "swift",
    dart: "dart", sql: "sql", r: "r", txt: "plaintext",
    env: "plaintext", toml: "toml", ini: "ini",
  }
  return map[ext] || "plaintext"
}

const SKIP_ENTRIES = new Set([
  "__MACOSX", ".DS_Store", "Thumbs.db", ".git",
  "node_modules", ".next", "dist", "build", ".cache", ".venv",
])

function shouldSkip(name: string): boolean {
  return SKIP_ENTRIES.has(name)
}

const TEXT_EXTENSIONS = new Set([
  "txt", "md", "markdown", "html", "htm", "css", "scss", "sass", "less",
  "js", "jsx", "mjs", "cjs", "ts", "tsx", "json", "yaml", "yml", "xml",
  "svg", "py", "rb", "php", "java", "kt", "kts", "c", "h", "cc", "cpp",
  "cxx", "hpp", "rs", "go", "swift", "dart", "r", "sql", "sh", "bash",
  "zsh", "fish", "toml", "ini", "conf", "env", "gitignore", "htaccess",
  "vue", "svelte", "astro", "gradle", "properties", "lock",
])

function isTextFile(filename: string): boolean {
  const clean = filename.split("/").pop() || filename
  const ext = clean.includes(".") ? clean.split(".").pop()?.toLowerCase() : clean.toLowerCase()
  return TEXT_EXTENSIONS.has(ext || "")
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ""
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export function fileNodeToBlob(node: FileNode): Blob {
  if (node.contentEncoding === "base64") {
    const bytes = base64ToBytes(node.content || "")
    const buffer = new ArrayBuffer(bytes.byteLength)
    new Uint8Array(buffer).set(bytes)
    return new Blob([buffer], { type: "application/octet-stream" })
  }
  return new Blob([node.content || ""], { type: "text/plain;charset=utf-8" })
}

async function readFileContent(file: Blob, filename: string): Promise<{ content: string; contentEncoding: "utf8" | "base64" }> {
  if (isTextFile(filename)) {
    try { return { content: await file.text(), contentEncoding: "utf8" } }
    catch { return { content: "", contentEncoding: "utf8" } }
  }
  try {
    return { content: bytesToBase64(new Uint8Array(await file.arrayBuffer())), contentEncoding: "base64" }
  } catch {
    return { content: "", contentEncoding: "base64" }
  }
}

export async function importFromZip(file: File): Promise<FileNode[]> {
  const zip = await JSZip.loadAsync(file)
  const sortedPaths = Object.keys(zip.files).sort()

  const pathMap = new Map<string, FileNode>()
  const roots: FileNode[] = []

  for (const relativePath of sortedPaths) {
    const zipFile = zip.files[relativePath]
    const parts = relativePath.split("/").filter(Boolean)
    if (parts.length === 0) continue
    if (parts.some(shouldSkip)) continue

    let parentNode: FileNode | null = null
    let currentPath = ""

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const isLast = i === parts.length - 1
      const childPath = currentPath ? `${currentPath}/${part}` : `/${part}`

      if (!pathMap.has(childPath)) {
        const isFile = isLast && !zipFile.dir
        const newNode: FileNode = {
          id: generateId(),
          name: part,
          type: isFile ? "file" : "folder",
          path: childPath,
          language: isFile ? getLanguage(part) : undefined,
          children: isFile ? undefined : [],
        }
        if (isFile) {
          const bytes = await zipFile.async("uint8array")
          if (isTextFile(part)) {
            newNode.content = new TextDecoder().decode(bytes)
            newNode.contentEncoding = "utf8"
          } else {
            newNode.content = bytesToBase64(bytes)
            newNode.contentEncoding = "base64"
          }
        }
        pathMap.set(childPath, newNode)
        if (parentNode) {
          if (!parentNode.children) parentNode.children = []
          parentNode.children.push(newNode)
        } else {
          roots.push(newNode)
        }
      }

      parentNode = pathMap.get(childPath)!
      currentPath = childPath
    }
  }

  return roots
}

export async function importFromFiles(files: FileList): Promise<FileNode[]> {
  const hasStructure = Array.from(files).some(
    (f) => ((f as File & { webkitRelativePath?: string }).webkitRelativePath || "").includes("/")
  )

  if (!hasStructure) {
    const nodes: FileNode[] = []
    for (const file of Array.from(files)) {
      if (shouldSkip(file.name)) continue
      const loaded = await readFileContent(file, file.name)
      nodes.push({
        id: generateId(),
        name: file.name,
        type: "file",
        path: `/${file.name}`,
        content: loaded.content,
        contentEncoding: loaded.contentEncoding,
        language: getLanguage(file.name),
      })
    }
    return nodes
  }

  const pathMap = new Map<string, FileNode>()
  const roots: FileNode[] = []

  for (const file of Array.from(files)) {
    const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name
    const parts = relativePath.split("/").filter(Boolean)
    if (parts.some(shouldSkip)) continue

    let parentNode: FileNode | null = null
    let currentPath = ""

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const isLast = i === parts.length - 1
      const childPath = currentPath ? `${currentPath}/${part}` : `/${part}`

      if (!pathMap.has(childPath)) {
        const isFile = isLast
        const newNode: FileNode = {
          id: generateId(),
          name: part,
          type: isFile ? "file" : "folder",
          path: childPath,
          language: isFile ? getLanguage(part) : undefined,
          children: isFile ? undefined : [],
        }
        if (isFile) {
          const loaded = await readFileContent(file, part)
          newNode.content = loaded.content
          newNode.contentEncoding = loaded.contentEncoding
        }
        pathMap.set(childPath, newNode)
        if (parentNode) {
          if (!parentNode.children) parentNode.children = []
          parentNode.children.push(newNode)
        } else {
          roots.push(newNode)
        }
      }

      parentNode = pathMap.get(childPath)!
      currentPath = childPath
    }
  }

  return roots
}

export async function exportToZip(nodes: FileNode[]): Promise<Blob> {
  const zip = new JSZip()
  function addToZip(node: FileNode, prefix = "") {
    if (node.type === "file") {
      if (node.contentEncoding === "base64") {
        zip.file(prefix + node.name, base64ToBytes(node.content || ""))
      } else {
        zip.file(prefix + node.name, node.content || "")
      }
    } else {
      const folderPath = prefix + node.name + "/"
      for (const child of node.children || []) {
        addToZip(child, folderPath)
      }
    }
  }
  for (const node of nodes) {
    addToZip(node)
  }
  return await zip.generateAsync({ type: "blob", compression: "DEFLATE" })
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

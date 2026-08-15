import JSZip from "jszip"
import { generateId, getLanguageFromExtension, type FileNode } from "@/types/ide"

type Report = (text: string, type?: "input" | "output" | "error" | "info" | "success") => void
export type PickedFile = File & { relativePath?: string }
export type ImportSummary = { files: number; binaryFiles: number; skippedFiles: number; overwrittenFiles: number }
export type ImportResult = { tree: FileNode[]; firstOpenable?: FileNode; summary: ImportSummary }
type Entry = FileSystemEntry & { file?: (callback: (file: File) => void, errorCallback?: (error: DOMException) => void) => void; createReader?: () => FileSystemDirectoryReader }
type FileSystemDirectoryReader = { readEntries: (callback: (entries: FileSystemEntry[]) => void, errorCallback?: (error: DOMException) => void) => void }
type EntryItem = DataTransferItem & { webkitGetAsEntry?: () => Entry | null }

const textExtensions = new Set(["html", "htm", "css", "scss", "sass", "less", "js", "mjs", "cjs", "jsx", "ts", "tsx", "json", "md", "txt", "py", "sh", "bash", "yaml", "yml", "xml", "svg", "toml", "ini", "env", "gitignore", "java", "c", "cpp", "h", "hpp", "go", "rs", "php", "sql", "rb", "vue", "svelte", "dart", "kt", "swift", "cs"])

function extension(path: string) {
  return path.split("/").at(-1)?.split(".").pop()?.toLowerCase() ?? ""
}

function normalizePath(path: string) {
  return path.replace(/\\/g, "/").split("/").filter((part) => part && part !== "." && part !== "..").join("/")
}

function inferMimeType(name: string, sourceMime = "") {
  if (sourceMime) return sourceMime
  const types: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", ico: "image/x-icon", pdf: "application/pdf", wasm: "application/wasm", mp3: "audio/mpeg", mp4: "video/mp4", woff: "font/woff", woff2: "font/woff2" }
  return types[extension(name)] || "application/octet-stream"
}

function toBase64(bytes: Uint8Array) {
  let binary = ""
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  return btoa(binary)
}

function isTextFile(path: string, mimeType: string, bytes: Uint8Array) {
  if (mimeType.startsWith("text/") || mimeType.includes("json") || mimeType.includes("javascript") || mimeType.includes("xml")) return true
  if (textExtensions.has(extension(path))) return true
  return !bytes.subarray(0, Math.min(bytes.length, 8192)).includes(0)
}

function createFileNode(path: string, bytes: Uint8Array, mimeType = "") {
  const normalized = normalizePath(path)
  const name = normalized.split("/").at(-1) || "untitled"
  const text = isTextFile(normalized, mimeType, bytes)
  return {
    id: generateId(),
    name,
    type: "file" as const,
    path: `/${normalized}`,
    content: text ? new TextDecoder().decode(bytes) : toBase64(bytes),
    encoding: text ? "text" as const : "base64" as const,
    mimeType: text ? "text/plain;charset=utf-8" : inferMimeType(name, mimeType),
    language: text ? getLanguageFromExtension(name) : "plaintext"
  }
}

function cloneNode(node: FileNode): FileNode {
  return { ...node, children: node.children?.map(cloneNode) }
}

function addAtPath(nodes: FileNode[], file: FileNode) {
  const pieces = file.path.slice(1).split("/")
  let cursor = nodes
  for (const [index, piece] of pieces.entries()) {
    if (index === pieces.length - 1) {
      const existingIndex = cursor.findIndex((node) => node.name === piece)
      if (existingIndex >= 0) cursor.splice(existingIndex, 1, file)
      else cursor.push(file)
      return
    }
    let folder = cursor.find((node) => node.type === "folder" && node.name === piece)
    if (!folder) {
      folder = { id: generateId(), name: piece, type: "folder", path: `/${pieces.slice(0, index + 1).join("/")}`, children: [] }
      cursor.push(folder)
    }
    cursor = folder.children ?? (folder.children = [])
  }
}

function flatten(nodes: FileNode[]): FileNode[] {
  return nodes.flatMap((node) => node.children ? [node, ...flatten(node.children)] : [node])
}

export function mergeFileTrees(current: FileNode[], incoming: FileNode[], mode: "replace" | "merge") {
  if (mode === "replace") return { tree: incoming.map(cloneNode), conflicts: 0 }
  const next = current.map(cloneNode)
  const knownPaths = new Set(flatten(current).filter((node) => node.type === "file").map((node) => node.path))
  const files = flatten(incoming).filter((node) => node.type === "file")
  const conflicts = files.filter((node) => knownPaths.has(node.path)).length
  files.forEach((node) => addAtPath(next, cloneNode(node)))
  return { tree: next, conflicts }
}

async function readDirectory(entry: Entry, prefix: string): Promise<PickedFile[]> {
  if (entry.isFile && entry.file) {
    const file = await new Promise<File>((resolve, reject) => entry.file?.(resolve, reject))
    return [Object.assign(file, { relativePath: `${prefix}${file.name}` })]
  }
  if (!entry.isDirectory || !entry.createReader) return []
  const reader = entry.createReader()
  const entries: FileSystemEntry[] = []
  await new Promise<void>((resolve, reject) => {
    const collect = () => reader.readEntries((batch) => {
      if (!batch.length) { resolve(); return }
      entries.push(...batch)
      collect()
    }, reject)
    collect()
  })
  const nested = await Promise.all(entries.map((child) => readDirectory(child as Entry, `${prefix}${entry.name}/`)))
  return nested.flat()
}

export function filesFromFileList(list: FileList) {
  return Array.from(list).map((file) => Object.assign(file, { relativePath: file.webkitRelativePath || file.name })) as PickedFile[]
}

export async function filesFromDataTransfer(dataTransfer: DataTransfer) {
  const items = Array.from(dataTransfer.items) as EntryItem[]
  const entries = items.map((item) => item.webkitGetAsEntry?.()).filter((entry): entry is Entry => Boolean(entry))
  if (!entries.length) return filesFromFileList(dataTransfer.files)
  return (await Promise.all(entries.map((entry) => readDirectory(entry, "")))).flat()
}

export async function pickedFilesToTree(files: PickedFile[], report: Report): Promise<ImportResult> {
  const tree: FileNode[] = []
  let firstOpenable: FileNode | undefined
  const summary: ImportSummary = { files: 0, binaryFiles: 0, skippedFiles: 0, overwrittenFiles: 0 }
  const paths = new Set<string>()
  for (const file of files) {
    if (file.size > 25 * 1024 * 1024) {
      summary.skippedFiles += 1
      report(`Skipped ${file.name}: files larger than 25 MB are not imported into the browser workspace.`, "error")
      continue
    }
    if (file.name.toLowerCase().endsWith(".zip")) {
      const archive = await JSZip.loadAsync(file)
      for (const entry of Object.values(archive.files).filter((candidate) => !candidate.dir)) {
        const path = normalizePath(entry.name)
        if (!path) continue
        const bytes = await entry.async("uint8array")
        if (bytes.byteLength > 25 * 1024 * 1024) {
          summary.skippedFiles += 1
          report(`Skipped ${path}: files larger than 25 MB are not imported into the browser workspace.`, "error")
          continue
        }
        if (paths.has(path)) summary.overwrittenFiles += 1
        paths.add(path)
        const node = createFileNode(path, bytes)
        if (node.encoding === "base64") summary.binaryFiles += 1
        if (!firstOpenable && node.encoding === "text") firstOpenable = node
        addAtPath(tree, node)
        summary.files += 1
      }
      continue
    }
    const path = normalizePath(file.relativePath || file.name)
    if (!path) continue
    if (paths.has(path)) summary.overwrittenFiles += 1
    paths.add(path)
    const node = createFileNode(path, new Uint8Array(await file.arrayBuffer()), file.type)
    if (node.encoding === "base64") summary.binaryFiles += 1
    if (!firstOpenable && node.encoding === "text") firstOpenable = node
    addAtPath(tree, node)
    summary.files += 1
  }
  report(`Imported ${summary.files} file${summary.files === 1 ? "" : "s"}${summary.binaryFiles ? ` including ${summary.binaryFiles} binary asset${summary.binaryFiles === 1 ? "" : "s"}` : ""}.`, "success")
  if (summary.overwrittenFiles) report(`${summary.overwrittenFiles} duplicate path${summary.overwrittenFiles === 1 ? " was" : "s were"} normalized during import.`, "info")
  return { tree, firstOpenable, summary }
}

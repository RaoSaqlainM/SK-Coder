import JSZip from "jszip"
import { generateId, getLanguageFromExtension, type FileNode } from "@/types/ide"

type PickedFile = File & { relativePath?: string }

export function filesFromFileList(list: FileList) {
  return Array.from(list).map((file) => Object.assign(file, { relativePath: file.webkitRelativePath || file.name })) as PickedFile[]
}

function insert(nodes: FileNode[], pieces: string[], content: string) {
  const [head, ...tail] = pieces
  if (!head) return nodes
  if (!tail.length) return [...nodes, { id: generateId(), name: head, type: "file", path: `/${pieces.join("/")}`, content, language: getLanguageFromExtension(head) }]
  const existing = nodes.find((node) => node.type === "folder" && node.name === head)
  const folder: FileNode = existing ?? { id: generateId(), name: head, type: "folder", path: `/${head}`, children: [] }
  const children = insert(folder.children ?? [], tail, content).map((node) => node.path.startsWith(`/${head}/`) ? node : { ...node, path: `/${head}${node.path}` })
  return existing ? nodes.map((node) => node.id === folder.id ? { ...folder, children } : node) : [...nodes, { ...folder, children }]
}

function normalizeTree(nodes: FileNode[], parent = ""): FileNode[] {
  return nodes.map((node) => { const path = `${parent}/${node.name}`.replace(/^\/{2,}/, "/"); return { ...node, path, children: node.children ? normalizeTree(node.children, path) : undefined } })
}

export async function pickedFilesToTree(files: PickedFile[], report: (text: string, type?: "input" | "output" | "error" | "info" | "success") => void) {
  const tree: FileNode[] = []
  let firstOpenable: FileNode | undefined
  for (const file of files) {
    if (file.name.toLowerCase().endsWith(".zip")) {
      const archive = await JSZip.loadAsync(file)
      const entries = Object.values(archive.files).filter((entry) => !entry.dir)
      for (const entry of entries) {
        const content = await entry.async("string")
        const parts = entry.name.split("/").filter(Boolean)
        if (!parts.length) continue
        const base = parts.at(-1)!
        const node: FileNode = { id: generateId(), name: base, type: "file", path: `/${parts.join("/")}`, content, language: getLanguageFromExtension(base) }
        if (!firstOpenable) firstOpenable = node
        let cursor = tree
        let prefix = ""
        for (const [index, piece] of parts.entries()) {
          prefix += `/${piece}`
          if (index === parts.length - 1) cursor.push({ ...node, path: prefix })
          else {
            let folder = cursor.find((candidate) => candidate.type === "folder" && candidate.name === piece)
            if (!folder) { folder = { id: generateId(), name: piece, type: "folder", path: prefix, children: [] }; cursor.push(folder) }
            cursor = folder.children ?? (folder.children = [])
          }
        }
      }
      report(`Imported ${entries.length} files from ${file.name}.`, "success")
      continue
    }
    const path = (file.relativePath || file.name).replace(/^\/+/, "")
    const content = await file.text()
    const parts = path.split("/").filter(Boolean)
    const base = parts.at(-1)!
    const node: FileNode = { id: generateId(), name: base, type: "file", path: `/${parts.join("/")}`, content, language: getLanguageFromExtension(base) }
    if (!firstOpenable) firstOpenable = node
    let cursor = tree
    let prefix = ""
    for (const [index, piece] of parts.entries()) {
      prefix += `/${piece}`
      if (index === parts.length - 1) cursor.push({ ...node, path: prefix })
      else {
        let folder = cursor.find((candidate) => candidate.type === "folder" && candidate.name === piece)
        if (!folder) { folder = { id: generateId(), name: piece, type: "folder", path: prefix, children: [] }; cursor.push(folder) }
        cursor = folder.children ?? (folder.children = [])
      }
    }
  }
  return { tree: normalizeTree(tree), firstOpenable }
}

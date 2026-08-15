import { generateId, getLanguageFromExtension, type FileNode } from "@/types/ide"

type GithubBlob = { content: string; encoding: "base64" }
type GithubRef = { object: { sha: string } }
type GithubCommit = { tree: { sha: string } }
type GithubTree = { tree: Array<{ path: string; type: "blob" | "tree"; sha: string }> }

export type GithubRepository = { owner: string; name: string; branch: string }

function headers(token: string) {
  return { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "Content-Type": "application/json" }
}

async function request<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`https://api.github.com${path}`, { ...init, headers: { ...headers(token), ...(init?.headers ?? {}) } })
  if (!response.ok) throw new Error(`GitHub ${response.status}: ${await response.text()}`)
  return await response.json() as T
}

function mimeTypeFromName(name: string) {
  const extension = name.split(".").pop()?.toLowerCase()
  const types: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml", ico: "image/x-icon", pdf: "application/pdf", zip: "application/zip", wasm: "application/wasm" }
  return types[extension ?? ""]
}

export function flattenWorkspaceFiles(nodes: FileNode[]): FileNode[] {
  return nodes.flatMap((node) => node.type === "file" ? [node] : flattenWorkspaceFiles(node.children ?? []))
}

function insert(nodes: FileNode[], parentPath: string, node: FileNode): FileNode[] {
  if (parentPath === "/") return [...nodes, node]
  return nodes.map((entry) => entry.path === parentPath ? { ...entry, children: [...(entry.children ?? []), node] } : entry.children ? { ...entry, children: insert(entry.children, parentPath, node) } : entry)
}

export function buildRemoteFileTree(files: Array<{ path: string; content: string }>): FileNode[] {
  let tree: FileNode[] = []
  const folders = new Set<string>()
  for (const file of [...files].sort((left, right) => left.path.localeCompare(right.path))) {
    const parts = file.path.split("/").filter(Boolean)
    let parentPath = "/"
    for (const part of parts.slice(0, -1)) {
      const folderPath = `${parentPath === "/" ? "" : parentPath}/${part}`
      if (!folders.has(folderPath)) {
        tree = insert(tree, parentPath, { id: generateId(), name: part, type: "folder", path: folderPath, children: [] })
        folders.add(folderPath)
      }
      parentPath = folderPath
    }
    const name = parts.at(-1)
    if (!name) continue
    const mimeType = mimeTypeFromName(name)
    tree = insert(tree, parentPath, { id: generateId(), name, type: "file", path: `${parentPath === "/" ? "" : parentPath}/${name}`, content: file.content, encoding: mimeType ? "base64" : "text", mimeType, language: mimeType ? "plaintext" : getLanguageFromExtension(name) })
  }
  return tree
}

export async function pushWorkspaceFiles(token: string, repository: GithubRepository, files: FileNode[], message: string) {
  const base = `/repos/${repository.owner}/${repository.name}`
  const ref = await request<GithubRef>(token, `${base}/git/ref/heads/${encodeURIComponent(repository.branch)}`)
  const parentCommit = await request<GithubCommit>(token, `${base}/git/commits/${ref.object.sha}`)
  const tree = await Promise.all(files.map(async (file) => {
    const blob = await request<{ sha: string }>(token, `${base}/git/blobs`, { method: "POST", body: JSON.stringify({ content: file.content ?? "", encoding: file.encoding === "base64" ? "base64" : "utf-8" }) })
    return { path: file.path.replace(/^\//, ""), mode: "100644", type: "blob", sha: blob.sha }
  }))
  const nextTree = await request<{ sha: string }>(token, `${base}/git/trees`, { method: "POST", body: JSON.stringify({ base_tree: parentCommit.tree.sha, tree }) })
  const commit = await request<{ sha: string }>(token, `${base}/git/commits`, { method: "POST", body: JSON.stringify({ message, tree: nextTree.sha, parents: [ref.object.sha] }) })
  await request<{ ref: string }>(token, `${base}/git/refs/heads/${encodeURIComponent(repository.branch)}`, { method: "PATCH", body: JSON.stringify({ sha: commit.sha, force: false }) })
  return commit.sha
}

export async function pullWorkspaceFiles(token: string, repository: GithubRepository) {
  const base = `/repos/${repository.owner}/${repository.name}`
  const remoteTree = await request<GithubTree>(token, `${base}/git/trees/${encodeURIComponent(repository.branch)}?recursive=1`)
  const blobs = remoteTree.tree.filter((entry) => entry.type === "blob")
  const files = await Promise.all(blobs.map(async (entry) => {
    const blob = await request<GithubBlob>(token, `${base}/git/blobs/${entry.sha}`)
    return { path: entry.path, content: blob.content.replace(/\n/g, "") }
  }))
  return buildRemoteFileTree(files)
}

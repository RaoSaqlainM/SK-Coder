import { generateId, getLanguageFromExtension, type FileNode } from "@/types/ide"

type Output = (text: string, type?: "input" | "output" | "error" | "info" | "success") => void

export type WorkspaceSandboxActions = {
  addFile: (parentPath: string, name: string, type: "file" | "folder", content?: string) => void
  deleteFileNode: (path: string) => void
  renameNode: (path: string, newName: string) => void
  moveNode: (fromPath: string, destinationPath: string) => void
  setFileTree: (tree: FileNode[]) => void
}

type SandboxOptions = {
  cwd?: string
  actions?: WorkspaceSandboxActions
}

export type SandboxCommandResult = { cwd: string }

function findByPath(nodes: FileNode[], path: string): FileNode | undefined {
  for (const node of nodes) {
    if (node.path === path) return node
    const found = node.children ? findByPath(node.children, path) : undefined
    if (found) return found
  }
}

function flatten(nodes: FileNode[]): FileNode[] {
  return nodes.flatMap((node) => [node, ...(node.children ? flatten(node.children) : [])])
}

function normalizePath(value: string, cwd: string): string {
  const source = value.startsWith("/") ? value : `${cwd === "/" ? "" : cwd}/${value}`
  const parts: string[] = []
  for (const part of source.split("/")) {
    if (!part || part === ".") continue
    if (part === "..") parts.pop()
    else parts.push(part)
  }
  return `/${parts.join("/")}`.replace(/\/$/, "") || "/"
}

function parentPath(path: string): string {
  const index = path.lastIndexOf("/")
  return index <= 0 ? "/" : path.slice(0, index)
}

function basename(path: string): string {
  return path.split("/").filter(Boolean).at(-1) || ""
}

function insertAt(nodes: FileNode[], parent: string, node: FileNode): FileNode[] {
  if (parent === "/") return [...nodes, node]
  return nodes.map((entry) => entry.path === parent && entry.type === "folder"
    ? { ...entry, children: [...(entry.children ?? []), node] }
    : entry.children ? { ...entry, children: insertAt(entry.children, parent, node) } : entry)
}

function rebase(node: FileNode, from: string, to: string): FileNode {
  const path = node.path === from ? to : `${to}${node.path.slice(from.length)}`
  return { ...node, id: generateId(), path, children: node.children?.map((child) => rebase(child, from, to)) }
}

function directoryListing(node: FileNode): string {
  if (node.type === "file") return node.name
  return (node.children ?? []).map((child) => `${child.type === "folder" ? "📁" : "📄"} ${child.name}`).join("  ") || "(empty directory)"
}

function commandError(output: Output, message: string, cwd: string): SandboxCommandResult {
  output(message, "error")
  return { cwd }
}

export async function runSandboxCommand(command: string, args: string[], tree: FileNode[], output: Output, setPreviewUrl: (url: string) => void, options: SandboxOptions = {}): Promise<SandboxCommandResult> {
  const cwd = options.cwd ?? "/"
  const actions = options.actions
  const resolve = (value?: string) => normalizePath(value || ".", cwd)
  const getNode = (value?: string) => findByPath(tree, resolve(value))

  if (command === "ls" || command === "dir") {
    const target = getNode(args[0])
    if (!target && args[0]) return commandError(output, `ls: ${args[0]}: No such file or directory`, cwd)
    output(target ? directoryListing(target) : directoryListing({ id: "root", name: "/", path: "/", type: "folder", children: tree }))
    return { cwd }
  }
  if (command === "pwd") {
    output(cwd)
    return { cwd }
  }
  if (command === "cd") {
    const targetPath = args[0] ? resolve(args[0]) : "/"
    const target = targetPath === "/" ? undefined : findByPath(tree, targetPath)
    if (targetPath !== "/" && (!target || target.type !== "folder")) return commandError(output, `cd: ${args[0]}: Not a directory`, cwd)
    return { cwd: targetPath }
  }
  if (command === "mkdir") {
    const name = args[0]?.trim()
    if (!name || name.includes("/")) return commandError(output, "mkdir: provide one folder name relative to the current directory", cwd)
    if (!actions) return commandError(output, "mkdir: workspace actions are unavailable", cwd)
    const path = resolve(name)
    if (findByPath(tree, path)) return commandError(output, `mkdir: ${name}: File exists`, cwd)
    actions.addFile(cwd === "/" ? "" : cwd, name, "folder")
    output(`Created ${path}`, "success")
    return { cwd }
  }
  if (command === "rm") {
    const target = getNode(args[0])
    if (!args[0] || !target) return commandError(output, `rm: ${args[0] || "missing operand"}: No such file or directory`, cwd)
    if (!actions) return commandError(output, "rm: workspace actions are unavailable", cwd)
    actions.deleteFileNode(target.path)
    const nextCwd = cwd === target.path || cwd.startsWith(`${target.path}/`) ? parentPath(target.path) : cwd
    output(`Removed ${target.path}`, "success")
    return { cwd: nextCwd }
  }
  if (command === "cat") {
    const file = getNode(args[0])
    if (!args[0] || !file || file.type !== "file") return commandError(output, `cat: ${args[0] || "missing operand"}: No such file`, cwd)
    if (file.encoding === "base64") return commandError(output, `cat: ${args[0]}: binary file`, cwd)
    output(file.content ?? "")
    return { cwd }
  }
  if (command === "cp") {
    const source = getNode(args[0])
    if (!args[0] || !args[1] || !source) return commandError(output, "cp: usage: cp <source> <destination>", cwd)
    if (!actions) return commandError(output, "cp: workspace actions are unavailable", cwd)
    const requested = resolve(args[1])
    const destination = findByPath(tree, requested)
    const destinationParent = destination?.type === "folder" ? destination.path : parentPath(requested)
    const destinationName = destination?.type === "folder" ? source.name : basename(requested)
    const nextPath = `${destinationParent === "/" ? "" : destinationParent}/${destinationName}`
    if (!destinationName || !findByPath(tree, destinationParent) && destinationParent !== "/") return commandError(output, `cp: ${args[1]}: destination directory does not exist`, cwd)
    if (findByPath(tree, nextPath)) return commandError(output, `cp: ${nextPath}: File exists`, cwd)
    if (source.type === "folder" && destinationParent.startsWith(`${source.path}/`)) return commandError(output, "cp: cannot copy a folder into itself", cwd)
    actions.setFileTree(insertAt(tree, destinationParent, rebase(source, source.path, nextPath)))
    output(`Copied ${source.path} to ${nextPath}`, "success")
    return { cwd }
  }
  if (command === "mv") {
    const source = getNode(args[0])
    if (!args[0] || !args[1] || !source) return commandError(output, "mv: usage: mv <source> <destination>", cwd)
    if (!actions) return commandError(output, "mv: workspace actions are unavailable", cwd)
    const requested = resolve(args[1])
    const destination = findByPath(tree, requested)
    const destinationParent = destination?.type === "folder" ? destination.path : parentPath(requested)
    const destinationName = destination?.type === "folder" ? source.name : basename(requested)
    const nextPath = `${destinationParent === "/" ? "" : destinationParent}/${destinationName}`
    if (!destinationName || destinationParent !== "/" && !findByPath(tree, destinationParent)) return commandError(output, `mv: ${args[1]}: destination directory does not exist`, cwd)
    if (source.type === "folder" && destinationParent.startsWith(`${source.path}/`)) return commandError(output, "mv: cannot move a folder into itself", cwd)
    if (nextPath !== source.path && findByPath(tree, nextPath)) return commandError(output, `mv: ${nextPath}: File exists`, cwd)
    const currentParent = parentPath(source.path)
    if (destinationName !== source.name) actions.renameNode(source.path, destinationName)
    const renamedPath = `${currentParent === "/" ? "" : currentParent}/${destinationName}`
    if (currentParent !== destinationParent) actions.moveNode(renamedPath, destinationParent)
    output(`Moved ${source.path} to ${nextPath}`, "success")
    return { cwd: cwd === source.path ? nextPath : cwd.startsWith(`${source.path}/`) ? `${nextPath}${cwd.slice(source.path.length)}` : cwd }
  }
  if (command === "echo") {
    output(args.join(" "))
    return { cwd }
  }
  if (command === "grep") {
    const pattern = args[0]
    const file = getNode(args[1])
    if (!pattern || !args[1] || !file || file.type !== "file") return commandError(output, "grep: usage: grep <pattern> <file>", cwd)
    if (file.encoding === "base64") return commandError(output, `grep: ${args[1]}: binary file`, cwd)
    const matches = (file.content ?? "").split("\n").flatMap((line, index) => line.includes(pattern) ? [`${file.path}:${index + 1}:${line}`] : [])
    if (!matches.length) output(`grep: no matches for ${pattern}`, "info")
    else matches.forEach((match) => output(match))
    return { cwd }
  }
  if (command === "find") {
    const pattern = args[0]?.toLowerCase()
    if (!pattern) return commandError(output, "find: usage: find <pattern>", cwd)
    const matches = flatten(tree).filter((node) => node.path.toLowerCase().includes(pattern)).map((node) => node.path)
    if (!matches.length) output(`find: no matches for ${args[0]}`, "info")
    else matches.forEach((match) => output(match))
    return { cwd }
  }
  if (command === "clear") {
    output("Terminal cleared.", "info")
    return { cwd }
  }
  if (command === "open") {
    const file = getNode(args[0])
    if (file?.name.endsWith(".html") && file.encoding !== "base64") setPreviewUrl(`data:text/html;charset=utf-8,${encodeURIComponent(file.content ?? "")}`)
    else output("Open supports HTML previews in the browser sandbox.", "info")
    return { cwd }
  }
  return commandError(output, `${command}: command unavailable in the browser sandbox.`, cwd)
}

export async function runWorkspaceProject(_tree: FileNode[], output: Output, _setPreviewUrl: (url: string) => void) {
  output("Project package scripts require the configured Oracle backend runtime.", "info")
  return { ok: false, message: "Backend runtime unavailable." }
}

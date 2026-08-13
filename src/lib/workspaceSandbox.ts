import type { FileNode } from "@/types/ide"

function find(nodes: FileNode[], path: string): FileNode | undefined { for (const node of nodes) { if (node.path === path || node.name === path) return node; const result = node.children ? find(node.children, path) : undefined; if (result) return result } }
type Output = (text: string, type?: "input" | "output" | "error" | "info" | "success") => void
export async function runSandboxCommand(command: string, args: string[], tree: FileNode[], output: Output, setPreviewUrl: (url: string) => void) {
  if (command === "ls") { output(tree.map((node) => node.name).join("  ") || "(empty workspace)"); return }
  if (command === "pwd") { output("/"); return }
  if (command === "cat") { const file = find(tree, args[0] ?? ""); output(file?.content ?? "File not found.", file ? "output" : "error"); return }
  if (command === "echo") { output(args.join(" ")); return }
  if (command === "clear") { output("Terminal cleared.", "info"); return }
  if (command === "open") { const file = find(tree, args[0] ?? ""); if (file?.name.endsWith(".html")) setPreviewUrl(`data:text/html;charset=utf-8,${encodeURIComponent(file.content ?? "")}`); else output("Open supports HTML previews in the browser sandbox.", "info"); return }
  output(`${command}: command unavailable in the browser sandbox.`, "error")
}
export async function runWorkspaceProject(_tree: FileNode[], output: Output, _setPreviewUrl: (url: string) => void) { output("Project package scripts require the configured Oracle backend runtime.", "info"); return { ok: false, message: "Backend runtime unavailable." } }

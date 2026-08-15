import { fileDataUrl, type FileNode } from "@/types/ide"

function walk(nodes: FileNode[]): FileNode[] { return nodes.flatMap((node) => node.children ? [node, ...walk(node.children)] : [node]) }
export function htmlToDataUrl(html: string) { return `data:text/html;charset=utf-8,${encodeURIComponent(html)}` }
export function findPreviewEntry(nodes: FileNode[]) { return walk(nodes).find((node) => node.type === "file" && /^(index|main)\.(html?|tsx?|jsx?)$/i.test(node.name)) ?? walk(nodes).find((node) => node.type === "file" && /\.html?$/i.test(node.name)) }
function withErrorReporter(html: string) {
  const reporter = `<script>window.addEventListener('error',function(event){parent.postMessage({source:'sk-coder-preview',message:event.message,line:event.lineno,column:event.colno},'*')});window.addEventListener('unhandledrejection',function(event){parent.postMessage({source:'sk-coder-preview',message:String(event.reason)},'*')});</script>`
  return /<\/head>/i.test(html) ? html.replace(/<\/head>/i, `${reporter}</head>`) : `${reporter}${html}`
}
export function buildHtmlPreview(file: FileNode, nodes: FileNode[]) {
  const content = inlineBinaryAssets(file.content ?? "", file.path, nodes)
  const styles = walk(nodes).filter((node) => node.type === "file" && node.name.endsWith(".css")).map((node) => `<style>${node.content ?? ""}</style>`).join("\n")
  const scripts = walk(nodes).filter((node) => node.type === "file" && /\.(js|mjs)$/i.test(node.name)).map((node) => `<script>${node.content ?? ""}</script>`).join("\n")
  if (/<!doctype|<html/i.test(content)) return withErrorReporter(content.replace("</head>", `${styles}</head>`).replace("</body>", `${scripts}</body>`))
  return withErrorReporter(`<!doctype html><html><head><meta charset="utf-8"/>${styles}</head><body>${content}${scripts}</body></html>`)
}

function inlineBinaryAssets(content: string, sourcePath: string, nodes: FileNode[]) {
  const byPath = new Map(walk(nodes).filter((node) => node.encoding === "base64").map((node) => [node.path, fileDataUrl(node)]))
  const resolve = (reference: string) => {
    if (!reference || /^(data:|https?:|#)/i.test(reference)) return reference
    const base = sourcePath.slice(0, sourcePath.lastIndexOf("/")) || "/"
    const absolute = reference.startsWith("/") ? reference : `${base}/${reference}`
    const parts: string[] = []
    absolute.split("/").forEach((part) => {
      if (!part || part === ".") return
      if (part === "..") parts.pop()
      else parts.push(part)
    })
    return byPath.get(`/${parts.join("/")}`) || reference
  }
  return content.replace(/\b(src|href)=(["'])([^"']+)\2/gi, (_match, attribute: string, quote: string, reference: string) => `${attribute}=${quote}${resolve(reference)}${quote}`).replace(/url\((["']?)([^)'"\s]+)\1\)/gi, (_match, quote: string, reference: string) => `url(${quote}${resolve(reference)}${quote})`)
}
export function buildReactPreview(file: FileNode, _nodes?: FileNode[]) { return withErrorReporter(`<!doctype html><html><body><pre style="font-family:monospace;white-space:pre-wrap">React and TypeScript preview requires the backend build runner.\n\n${file.content ?? ""}</pre></body></html>`) }

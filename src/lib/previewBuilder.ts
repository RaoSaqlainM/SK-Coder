import type { FileNode } from "../types/ide"

function flattenFiles(nodes: FileNode[]): Map<string, FileNode> {
  const map = new Map<string, FileNode>()
  function walk(ns: FileNode[]) {
    for (const n of ns) {
      map.set(n.path, n)
      if (n.children) walk(n.children)
    }
  }
  walk(nodes)
  return map
}

function buildInlineHtml(html: string, css: string, js: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<style>${css}</style>
</head>
<body>
${html}
<script>
(function() {
  const origConsole = window.console;
  const log = (...a) => { origConsole.log(...a); window.parent.postMessage({ type: 'console', level: 'log', args: a.map(x => typeof x === 'object' ? JSON.stringify(x) : String(x)) }, '*') };
  const err = (...a) => { origConsole.error(...a); window.parent.postMessage({ type: 'console', level: 'error', args: a.map(x => typeof x === 'object' ? JSON.stringify(x) : String(x)) }, '*') };
  window.console = { ...origConsole, log, error, warn: log, info: log };
  window.addEventListener('error', (e) => { window.parent.postMessage({ type: 'error', message: e.message, filename: e.filename, line: e.lineno }, '*') });
})();
${js}
</script>
</body>
</html>`
}

export function buildPreview(fileTree: FileNode[], activePath?: string): string {
  const files = flattenFiles(fileTree)

  const htmlFile = activePath
    ? (files.get(activePath)?.language === "html" ? files.get(activePath) : null)
    : findFirst(files, "html")

  if (htmlFile) {
    let html = htmlFile.content || ""
    const dir = htmlFile.path.substring(0, htmlFile.path.lastIndexOf("/"))

    html = html.replace(/<link[^>]+href="([^"]+\.css)"[^>]*>/gi, (match, href) => {
      if (href.startsWith("http")) return match
      const cssPath = `${dir}/${href}`
      const cssNode = files.get(cssPath)
      if (cssNode) return `<style>${cssNode.content || ""}</style>`
      return match
    })

    html = html.replace(/<script[^>]+src="([^"]+\.(?:js|ts))"[^>]*><\/script>/gi, (match, src) => {
      if (src.startsWith("http")) return match
      const jsPath = `${dir}/${src}`
      const jsNode = files.get(jsPath)
      if (jsNode) return `<script>${jsNode.content || ""}</script>`
      return match
    })

    return html
  }

  const cssFile = findFirst(files, "css")
  const jsFile = findFirst(files, "javascript")

  if (jsFile || cssFile) {
    const bodyContent = `<div id="app"></div>`
    return buildInlineHtml(
      bodyContent,
      cssFile?.content || "",
      jsFile?.content || ""
    )
  }

  if (activePath) {
    const node = files.get(activePath)
    if (node?.language === "css") {
      return buildInlineHtml(
        `<div class="preview-wrapper">
          <h2>CSS Preview</h2>
          <div class="box"></div>
          <p>Your CSS styles are applied above.</p>
        </div>`,
        node.content || "",
        ""
      )
    }
    if (node?.language === "javascript") {
      return buildInlineHtml(
        `<div id="app"></div>`,
        `body { background: #0f0f1a; color: #e2e2f0; font-family: monospace; padding: 1rem; }`,
        node.content || ""
      )
    }
    if (node?.language === "markdown") {
      return buildMarkdownPreview(node.content || "")
    }
  }

  return buildInlineHtml(
    `<div style="text-align:center;padding:3rem;color:#6c7086;">
      <h2 style="color:#007acc;">Preview</h2>
      <p>Open an HTML file or add index.html to see a live preview.</p>
    </div>`,
    `body { background: #1e1e2e; margin: 0; font-family: sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; }`,
    ""
  )
}

function findFirst(files: Map<string, FileNode>, language: string): FileNode | undefined {
  for (const node of files.values()) {
    if (node.type === "file" && node.language === language) return node
  }
  return undefined
}

function buildMarkdownPreview(md: string): string {
  let html = md
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank">$1</a>')
    .replace(/^---$/gm, "<hr/>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/\n/g, "<br/>")

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/><style>
    body { background: #1e1e2e; color: #cdd6f4; font-family: system-ui, sans-serif; padding: 2rem; max-width: 800px; margin: 0 auto; line-height: 1.6; }
    h1,h2,h3 { color: #89b4fa; } code { background: #313244; padding: 0.1em 0.4em; border-radius: 4px; font-family: monospace; }
    a { color: #89dceb; } hr { border-color: #313244; }
    li { margin: 0.25rem 0; }
  </style></head><body>${html}</body></html>`
}

import type { FileNode } from "../types/ide";
import { getPreviewKind } from "./projectCapabilities";
function flattenFiles(nodes: FileNode[]): Map<string, FileNode> {
    const map = new Map<string, FileNode>();
    function walk(ns: FileNode[]) {
        for (const n of ns) {
            map.set(n.path, n);
            if (n.children)
                walk(n.children);
        }
    }
    walk(nodes);
    return map;
}
function resolveProjectPath(directory: string, reference: string): string {
    const rawPath = reference.split(/[?#]/, 1)[0];
    const parts = (rawPath.startsWith("/") ? rawPath.slice(1) : `${directory ? `${directory}/` : ""}${rawPath}`).split("/");
    const resolved: string[] = [];
    for (const part of parts) {
        if (!part || part === ".")
            continue;
        if (part === "..")
            resolved.pop();
        else
            resolved.push(part);
    }
    return `/${resolved.join("/")}`;
}
function assetSource(node: FileNode | undefined, sources: Map<string, string>): string | undefined {
    return node?.assetData || sources.get(node?.path || "");
}
function inlineProjectAssets(content: string, directory: string, files: Map<string, FileNode>, sources: Map<string, string>): string {
    return content.replace(/(\b(?:src|poster|href)\s*=\s*["'])([^"']+)(["'])/gi, (match, prefix, reference, suffix) => {
        if (/^(?:data:|blob:|https?:|#)/i.test(reference))
            return match;
        const asset = assetSource(files.get(resolveProjectPath(directory, reference)), sources);
        return asset ? `${prefix}${asset}${suffix}` : match;
    });
}
function inlineCssImageAssets(css: string, directory: string, files: Map<string, FileNode>, sources: Map<string, string>): string {
    return css.replace(/url\(\s*(['"]?)([^'"\)]+)\1\s*\)/gi, (match, quote, reference) => {
        if (/^(?:data:|blob:|https?:|#)/i.test(reference))
            return match;
        const asset = assetSource(files.get(resolveProjectPath(directory, reference)), sources);
        return asset ? `url("${asset}")` : match;
    });
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
  window.console = { ...origConsole, log, error: err, warn: log, info: log };
})();
${js}
</script>
</body>
</html>`;
}
export function buildPreview(fileTree: FileNode[], activePath?: string, sources = new Map<string, string>()): string {
    const files = flattenFiles(fileTree);
    if (activePath) {
        const mediaNode = files.get(activePath);
        const mediaSource = assetSource(mediaNode, sources);
        const previewKind = mediaNode ? getPreviewKind(mediaNode) : null;
        if (mediaNode?.type === "file" && mediaSource && previewKind) {
            const safeName = mediaNode.name.replace(/[&<>"']/g, (value) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[value] || value));
            const mediaElement = previewKind === "image"
                ? `<img src="${mediaSource}" alt="${safeName}"/>`
                : previewKind === "video"
                    ? `<video controls preload="metadata" src="${mediaSource}">This browser cannot play this video file.</video>`
                    : previewKind === "audio"
                        ? `<audio controls preload="metadata" src="${mediaSource}">This browser cannot play this audio file.</audio>`
                        : `<object data="${mediaSource}" type="application/pdf"><a href="${mediaSource}" download="${safeName}">Download ${safeName}</a></object>`;
            return buildInlineHtml(`<main class="media-preview">${mediaElement}<p>${safeName}</p></main>`, "body{margin:0;min-height:100vh;background:#0d1117;color:#c9d1d9;font:13px system-ui;display:grid;place-items:center}.media-preview{display:grid;gap:12px;justify-items:center;padding:24px;box-sizing:border-box;width:100%;height:100vh}.media-preview img,.media-preview video,.media-preview object{max-width:100%;max-height:calc(100vh - 74px);object-fit:contain;border-radius:8px;box-shadow:0 10px 32px rgba(0,0,0,.38)}.media-preview object{width:100%;height:calc(100vh - 74px);border:0;background:#fff}.media-preview video{background:#000}.media-preview audio{width:min(560px,100%)}.media-preview p{margin:0;color:#8b949e}", "");
        }
    }
    const htmlFile = activePath
        ? (files.get(activePath)?.language === "html" ? files.get(activePath) : null)
        : findFirst(files, "html");
    if (htmlFile) {
        let html = htmlFile.content || "";
        const dir = htmlFile.path.substring(0, htmlFile.path.lastIndexOf("/"));
        html = html.replace(/<link[^>]+href="([^"]+\.css)"[^>]*>/gi, (match, href) => {
            if (href.startsWith("http"))
                return match;
            const cssPath = resolveProjectPath(dir, href);
            const cssNode = files.get(cssPath);
            if (cssNode)
                return `<style>${inlineCssImageAssets(cssNode.content || "", cssNode.path.substring(0, cssNode.path.lastIndexOf("/")), files, sources)}</style>`;
            return match;
        });
        html = html.replace(/<script[^>]+src="([^"]+\.(?:js|ts))"[^>]*><\/script>/gi, (match, src) => {
            if (src.startsWith("http"))
                return match;
            const jsPath = resolveProjectPath(dir, src);
            const jsNode = files.get(jsPath);
            if (jsNode)
                return `<script>${jsNode.content || ""}</script>`;
            return match;
        });
        return inlineProjectAssets(html, dir, files, sources);
    }
    const cssFile = findFirst(files, "css");
    const jsFile = findFirst(files, "javascript");
    if (jsFile || cssFile) {
        const bodyContent = `<div id="app"></div>`;
        return buildInlineHtml(bodyContent, cssFile?.content || "", jsFile?.content || "");
    }
    if (activePath) {
        const node = files.get(activePath);
        if (node?.language === "css") {
            return buildInlineHtml(`<div class="preview-wrapper">
          <h2>CSS Preview</h2>
          <div class="box"></div>
          <p>Your CSS styles are applied above.</p>
        </div>`, node.content || "", "");
        }
        if (node?.language === "javascript") {
            return buildInlineHtml(`<div id="app"></div>`, `body { background: #0f0f1a; color: #e2e2f0; font-family: monospace; padding: 1rem; }`, node.content || "");
        }
        if (node?.language === "markdown") {
            return buildMarkdownPreview(node.content || "");
        }
    }
    return buildInlineHtml(`<div style="text-align:center;padding:3rem;color:#6c7086;">
      <h2 style="color:#007acc;">Preview</h2>
      <p>Open an HTML file or add index.html to see a live preview.</p>
    </div>`, `body { background: #1e1e2e; margin: 0; font-family: sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; }`, "");
}
function findFirst(files: Map<string, FileNode>, language: string): FileNode | undefined {
    for (const node of files.values()) {
        if (node.type === "file" && node.language === language)
            return node;
    }
    return undefined;
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
        .replace(/\n/g, "<br/>");
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"/><style>
    body { background: #1e1e2e; color: #cdd6f4; font-family: system-ui, sans-serif; padding: 2rem; max-width: 800px; margin: 0 auto; line-height: 1.6; }
    h1,h2,h3 { color: #89b4fa; } code { background: #313244; padding: 0.1em 0.4em; border-radius: 4px; font-family: monospace; }
    a { color: #89dceb; } hr { border-color: #313244; }
    li { margin: 0.25rem 0; }
  </style></head><body>${html}</body></html>`;
}

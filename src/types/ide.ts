export type FileNode = {
  id: string
  name: string
  type: "file" | "folder"
  path: string
  content?: string
  children?: FileNode[]
  language?: string
}

export type Tab = {
  id: string
  fileId: string
  path: string
  name: string
  language: string
  content: string
  modified: boolean
  isDirty: boolean
}

export type TerminalType = "shell" | "python" | "javascript" | "node" | "java" | "cpp" | "bash" | "kali" | "gitbash"
export type ActivePanel = "files" | "editor" | "terminal" | "preview" | "ai" | "settings" | "cloud" | "apk"
export type PreviewViewport = "mobile" | "tablet" | "desktop"
export type TerminalLine = { id: string; text: string; type: "input" | "output" | "error" | "info" | "success"; timestamp: number; filePath?: string; lineNumber?: number; columnNumber?: number }
export type AIChatMessage = { id: string; role: "user" | "assistant"; content: string; timestamp: number }
export type ErrorEntry = { id: string; line: number; col?: number; message: string; severity: "error" | "warning" | "info"; file?: string }

export type Settings = {
  editor: { fontSize: number; fontFamily: string; tabSize: number; wordWrap: "on" | "off" | "wordWrapColumn"; minimap: boolean; lineNumbers: "on" | "off" | "relative"; autoSave: boolean; theme: "vs-dark" | "vs-light" | "hc-black"; bracketPairs: boolean; smoothScrolling: boolean; cursorStyle: "line" | "block" | "underline"; renderWhitespace: "none" | "boundary" | "all" }
  ai: { apiKey: string; apiEndpoint: string; model: string; keyStatus: "none" | "valid" | "invalid" | "expired" | "checking"; autoContext: boolean; autoAnalyze: boolean; usePuter: boolean }
  storage: { workspacePath: string; useExternalStorage: boolean; sdCardPath: string; downloadPath: string; mobileWorkspacePath: string; browserDownloadPath: string }
  github: { token: string; username: string; codespaceActive: string }
  preview: { viewport: PreviewViewport; autoRefresh: boolean; port: string; showErrors: boolean }
  piston: { serverUrl: string }
  backend: { url: string; enabled: boolean }
}

export type FileTemplate = { name: string; ext: string; template: string }

export const FILE_CATEGORIES: Record<string, FileTemplate[]> = {
  Web: [
    { name: "HTML", ext: ".html", template: "<!doctype html>\n<html lang=\"en\">\n<head>\n  <meta charset=\"UTF-8\" />\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />\n  <title>SK Coder Project</title>\n</head>\n<body>\n  <main>Hello, SK Coder.</main>\n</body>\n</html>\n" },
    { name: "CSS", ext: ".css", template: "* { box-sizing: border-box; }\nbody { margin: 0; font-family: system-ui, sans-serif; }\n" },
    { name: "JavaScript", ext: ".js", template: "console.log('Hello from SK Coder');\n" },
    { name: "TypeScript", ext: ".ts", template: "const message: string = 'Hello from SK Coder';\nconsole.log(message);\n" }
  ],
  Programming: [
    { name: "Python", ext: ".py", template: "print('Hello from SK Coder')\n" },
    { name: "Bash", ext: ".sh", template: "#!/usr/bin/env bash\necho 'Hello from SK Coder'\n" },
    { name: "Node.js", ext: ".mjs", template: "console.log('Hello from Node.js');\n" }
  ],
  Project: [
    { name: "README", ext: ".md", template: "# SK Coder Project\n\nBuilt with SK Coder.\n" },
    { name: "JSON", ext: ".json", template: "{\n  \"name\": \"sk-coder-project\"\n}\n" }
  ]
}

export function generateId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
}

export function getLanguageFromExtension(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? ""
  const languages: Record<string, string> = { js: "javascript", jsx: "javascript", ts: "typescript", tsx: "typescript", py: "python", html: "html", htm: "html", css: "css", json: "json", md: "markdown", sh: "shell", bash: "shell", c: "c", cpp: "cpp", cc: "cpp", java: "java", go: "go", rs: "rust", php: "php", xml: "xml", yaml: "yaml", yml: "yaml" }
  return languages[ext] ?? "plaintext"
}

export function getFileSize(content: string) {
  const bytes = new Blob([content]).size
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

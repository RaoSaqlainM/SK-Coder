export type FileNode = {
  id: string
  name: string
  type: "file" | "folder"
  content?: string
  contentEncoding?: "utf8" | "base64"
  children?: FileNode[]
  language?: string
  path: string
  modified?: boolean
}

export type Tab = {
  id: string
  fileId: string
  path: string
  name: string
  modified: boolean
  language: string
}

export type TerminalType = "python" | "javascript" | "node" | "cpp" | "shell" | "git"

export type TerminalLine = {
  id: string
  type: "input" | "output" | "error" | "info" | "success"
  content: string
  timestamp: number
}

export type AIChatMessage = {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: number
}

export type AIKeyStatus = "none" | "valid" | "invalid" | "expired" | "checking"

export type ActivePanel = "files" | "editor" | "terminal" | "preview" | "ai" | "settings" | "cloud" | "apk"

export type PreviewViewport = "mobile" | "tablet" | "desktop"

export type ContextMenuEntry = {
  label: string
  icon?: string
  action: string
  divider?: boolean
  danger?: boolean
}

export type ErrorEntry = {
  id: string
  line: number
  col?: number
  message: string
  severity: "error" | "warning" | "info"
  file?: string
}

export type Settings = {
  editor: {
    fontSize: number
    fontFamily: string
    tabSize: number
    wordWrap: "on" | "off" | "wordWrapColumn"
    minimap: boolean
    lineNumbers: "on" | "off" | "relative"
    autoSave: boolean
    theme: "vs-dark" | "vs-light" | "hc-black"
    bracketPairs: boolean
    smoothScrolling: boolean
    cursorStyle: "line" | "block" | "underline"
    renderWhitespace: "none" | "boundary" | "all"
  }
  ai: {
    apiKey: string
    apiEndpoint: string
    model: string
    keyStatus: AIKeyStatus
    autoContext: boolean
    usePuter?: boolean
  }
  storage: {
    workspacePath: string
    useExternalStorage: boolean
    sdCardPath: string
    downloadPath: string
  }
  github: {
    token: string
    username: string
    codespaceActive: string
  }
  preview: {
    viewport: PreviewViewport
    autoRefresh: boolean
    port: string
  }
  piston: {
    serverUrl: string
  }
  backend: {
    url: string
    enabled: boolean
  }
}

export type Codespace = {
  id: string
  name: string
  display_name: string
  state: string
  repository: { full_name: string }
  web_url: string
  created_at: string
  last_used_at: string
}

export type GitStatus = {
  modified: string[]
  staged: string[]
  untracked: string[]
  branch: string
}

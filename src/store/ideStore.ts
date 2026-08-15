import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import type {
  FileNode, Tab, TerminalType, TerminalLine, AIChatMessage, ActivePanel, Settings, ErrorEntry,
} from "../types/ide"

const DEFAULT_SETTINGS: Settings = {
  editor: {
    fontSize: 14,
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    tabSize: 2,
    wordWrap: "on",
    minimap: false,
    lineNumbers: "on",
    autoSave: true,
    theme: "vs-dark",
    bracketPairs: true,
    smoothScrolling: true,
    cursorStyle: "line",
    renderWhitespace: "none",
  },
  ai: {
    apiKey: "",
    apiEndpoint: "",
    model: "",
    keyStatus: "none",
    autoContext: true,
    usePuter: false,
  },
  storage: {
    workspacePath: "",
    useExternalStorage: false,
    sdCardPath: "/sdcard/SKCoder",
    downloadPath: "",
  },
  github: {
    token: "",
    username: "",
    codespaceActive: "",
  },
  preview: {
    viewport: "mobile",
    autoRefresh: true,
    port: "3000",
  },
  piston: {
    serverUrl: "https://emkc.org/api/v2/piston",
  },
  backend: {
    url: "",
    enabled: true,
  },
}

const FILE_CONTENT_PREFIX = "sk-file:"

function saveFileContent(path: string, content: string) {
  try { localStorage.setItem(FILE_CONTENT_PREFIX + path, content) } catch { }
}

function loadFileContent(path: string): string {
  return localStorage.getItem(FILE_CONTENT_PREFIX + path) ?? ""
}

function deleteFileContent(path: string) {
  localStorage.removeItem(FILE_CONTENT_PREFIX + path)
}

function renameFileContent(oldPath: string, newPath: string) {
  const content = localStorage.getItem(FILE_CONTENT_PREFIX + oldPath) ?? ""
  localStorage.removeItem(FILE_CONTENT_PREFIX + oldPath)
  try { localStorage.setItem(FILE_CONTENT_PREFIX + newPath, content) } catch { }
}

function rewriteNodePaths(node: FileNode, oldPrefix: string, newPrefix: string): FileNode {
  const nextPath = node.path === oldPrefix
    ? newPrefix
    : node.path.startsWith(`${oldPrefix}/`)
    ? `${newPrefix}${node.path.slice(oldPrefix.length)}`
    : node.path
  if (node.type === "file" && nextPath !== node.path) renameFileContent(node.path, nextPath)
  return {
    ...node,
    path: nextPath,
    children: node.children?.map((child) => rewriteNodePaths(child, oldPrefix, newPrefix)),
  }
}

function rewriteImportedPaths(nodes: FileNode[], parentPath: string): FileNode[] {
  const prefix = parentPath === "/" || !parentPath ? "" : parentPath
  return nodes.map((node) => {
    const nextPath = `${prefix}${node.path}`.replace(/\/{2,}/g, "/")
    if (node.type === "file") renameFileContent(node.path, nextPath)
    return {
      ...node,
      path: nextPath,
      children: node.children ? rewriteImportedPaths(node.children, prefix || "/") : undefined,
    }
  })
}

function saveAllFileContents(nodes: FileNode[]) {
  for (const node of nodes) {
    if (node.type === "file" && node.content !== undefined) saveFileContent(node.path, node.content)
    if (node.children) saveAllFileContents(node.children)
  }
}

function stripContent(nodes: FileNode[]): FileNode[] {
  return nodes.map((n) => ({
    ...n,
    content: undefined,
    children: n.children ? stripContent(n.children) : undefined,
  }))
}

function restoreContent(nodes: FileNode[]): FileNode[] {
  return nodes.map((n) => ({
    ...n,
    content: n.type === "file" ? loadFileContent(n.path) : undefined,
    children: n.children ? restoreContent(n.children) : undefined,
  }))
}

function deleteAllFileContents(nodes: FileNode[]) {
  for (const node of nodes) {
    if (node.type === "file") deleteFileContent(node.path)
    if (node.children) deleteAllFileContents(node.children)
  }
}

type ContextMenuState = { x: number; y: number; node: FileNode | null; isFolder: boolean } | null

type IDEState = {
  fileTree: FileNode[]
  flatFiles: Map<string, FileNode>
  openTabs: Tab[]
  activeTabId: string | null
  activePanel: ActivePanel
  terminalType: TerminalType
  terminalLines: TerminalLine[]
  terminalInput: string
  aiChatMessages: AIChatMessage[]
  aiChatOpen: boolean
  aiTyping: boolean
  previewContent: string
  previewKey: number
  contextMenu: ContextMenuState
  expandedFolders: Set<string>
  sidebarOpen: boolean
  isRunning: boolean
  renameNodeId: string | null
  newItemParentId: string | null
  newItemType: "file" | "folder" | null
  settings: Settings
  showSettings: boolean
  settingsTab: string
  dragOverId: string | null
  terminalBridgeCmd: { cmd: string; targetTab?: string; cwd?: string } | null
  errors: ErrorEntry[]
}

type IDEActions = {
  setTerminalBridgeCmd: (cmd: { cmd: string; targetTab?: string; cwd?: string } | null) => void
  openInTerminal: (path: string, isFolder: boolean) => void
  setErrors: (errors: ErrorEntry[]) => void
  setFileTree: (tree: FileNode[]) => void
  addFile: (parentPath: string, name: string, type: "file" | "folder", content?: string) => void
  deleteNode: (path: string) => void
  renameNode: (path: string, newName: string) => void
  updateFileContent: (path: string, content: string) => void
  moveNode: (fromPath: string, toFolderPath: string) => void
  openTab: (node: FileNode) => void
  closeTab: (tabId: string) => void
  setActiveTab: (tabId: string) => void
  markTabModified: (tabId: string, modified: boolean) => void
  setActivePanel: (panel: ActivePanel) => void
  setTerminalType: (type: TerminalType) => void
  addTerminalLine: (line: Omit<TerminalLine, "id" | "timestamp">) => void
  clearTerminal: () => void
  setTerminalInput: (input: string) => void
  addAIChatMessage: (message: Omit<AIChatMessage, "id" | "timestamp">) => void
  clearAIChat: () => void
  setAIChatOpen: (open: boolean) => void
  setAITyping: (typing: boolean) => void
  setPreviewContent: (html: string) => void
  refreshPreview: () => void
  setContextMenu: (menu: ContextMenuState) => void
  toggleFolder: (path: string) => void
  setSidebarOpen: (open: boolean) => void
  setIsRunning: (running: boolean) => void
  setRenameNodeId: (id: string | null) => void
  setNewItem: (parentId: string | null, type: "file" | "folder" | null) => void
  updateSettings: (settings: Partial<Settings>) => void
  updateEditorSettings: (settings: Partial<Settings["editor"]>) => void
  updateAISettings: (settings: Partial<Settings["ai"]>) => void
  updateStorageSettings: (settings: Partial<Settings["storage"]>) => void
  updateGithubSettings: (settings: Partial<Settings["github"]>) => void
  updatePreviewSettings: (settings: Partial<Settings["preview"]>) => void
  setShowSettings: (show: boolean) => void
  setSettingsTab: (tab: string) => void
  importFiles: (files: FileNode[], parentPath?: string) => void
  setDragOver: (id: string | null) => void
  buildFlatFiles: () => void
  getFileContent: (path: string) => string | undefined
  getActiveFile: () => FileNode | undefined
}

function generateId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

function getLanguage(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || ""
  const map: Record<string, string> = {
    ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
    py: "python", cpp: "cpp", c: "c", cc: "cpp", cxx: "cpp", h: "cpp",
    html: "html", htm: "html", css: "css", scss: "scss", sass: "sass",
    json: "json", yaml: "yaml", yml: "yaml", xml: "xml",
    md: "markdown", markdown: "markdown", sh: "shell", bash: "shell",
    java: "java", kt: "kotlin", rs: "rust", go: "go", rb: "ruby",
    php: "php", sql: "sql", r: "r", swift: "swift", dart: "dart",
    txt: "plaintext", env: "plaintext", gitignore: "plaintext",
    toml: "toml", ini: "ini", conf: "ini",
  }
  return map[ext] || "plaintext"
}

function flattenTree(nodes: FileNode[], map: Map<string, FileNode>) {
  for (const node of nodes) {
    map.set(node.path, node)
    if (node.children) flattenTree(node.children, map)
  }
}

function insertNodeAtPath(nodes: FileNode[], parentPath: string, newNode: FileNode): FileNode[] {
  return nodes.map((node) => {
    if (node.path === parentPath && node.type === "folder") {
      return { ...node, children: [...(node.children || []), newNode] }
    }
    if (node.children) return { ...node, children: insertNodeAtPath(node.children, parentPath, newNode) }
    return node
  })
}

function replaceChildrenAtPath(nodes: FileNode[], path: string, children: FileNode[]): FileNode[] {
  return nodes.map((node) => {
    if (node.path === path && node.type === "folder") return { ...node, children }
    if (node.children) return { ...node, children: replaceChildrenAtPath(node.children, path, children) }
    return node
  })
}

function deleteNodeAtPath(nodes: FileNode[], path: string): FileNode[] {
  return nodes
    .filter((n) => n.path !== path)
    .map((n) => n.children ? { ...n, children: deleteNodeAtPath(n.children, path) } : n)
}

function renameNodeAtPath(nodes: FileNode[], path: string, newName: string, newPath: string): FileNode[] {
  return nodes.map((n) => {
    if (n.path === path) return rewriteNodePaths({ ...n, name: newName }, path, newPath)
    if (n.children) return { ...n, children: renameNodeAtPath(n.children, path, newName, newPath) }
    return n
  })
}

function updateContentAtPath(nodes: FileNode[], path: string, content: string): FileNode[] {
  return nodes.map((n) => {
    if (n.path === path) return { ...n, content }
    if (n.children) return { ...n, children: updateContentAtPath(n.children, path, content) }
    return n
  })
}

const INIT_LINES: TerminalLine[] = [
  { id: "i1", type: "info", content: "SK Coder Python Terminal — type Python code and press Enter.", timestamp: Date.now() },
  { id: "i2", type: "info", content: "Run any file via the ▶ Run button in the top bar.", timestamp: Date.now() },
]

export const useIDEStore = create<IDEState & IDEActions>()(
  persist(
    (set, get) => ({
      fileTree: [],
      flatFiles: new Map(),
      openTabs: [],
      activeTabId: null,
      activePanel: "editor",
      terminalType: "python",
      terminalLines: INIT_LINES,
      terminalInput: "",
      aiChatMessages: [],
      aiChatOpen: false,
      aiTyping: false,
      previewContent: "",
      previewKey: 0,
      contextMenu: null,
      expandedFolders: new Set(),
      sidebarOpen: true,
      isRunning: false,
      renameNodeId: null,
      newItemParentId: null,
      newItemType: null,
      settings: DEFAULT_SETTINGS,
      showSettings: false,
      settingsTab: "editor",
      dragOverId: null,
      terminalBridgeCmd: null,
      errors: [],

      buildFlatFiles: () => {
        const map = new Map<string, FileNode>()
        flattenTree(get().fileTree, map)
        set({ flatFiles: map })
      },

      getFileContent: (path) => {
        return get().flatFiles.get(path)?.content
      },

      getActiveFile: () => {
        const { openTabs, activeTabId, flatFiles } = get()
        if (!activeTabId) return undefined
        const tab = openTabs.find((t) => t.id === activeTabId)
        if (!tab) return undefined
        return flatFiles.get(tab.path)
      },

      setFileTree: (tree) => {
        saveAllFileContents(tree)
        const map = new Map<string, FileNode>()
        flattenTree(tree, map)
        set({ fileTree: tree, flatFiles: map })
      },

      addFile: (parentPath, name, type, content = "") => {
        const id = generateId()
        const path = parentPath === "" ? `/${name}` : `${parentPath}/${name}`
        const siblings = parentPath === "" || parentPath === "/"
          ? get().fileTree
          : get().flatFiles.get(parentPath)?.children || []
        if (siblings.some((s) => s.name.toLowerCase() === name.trim().toLowerCase())) return
        if (type === "file") saveFileContent(path, content)
        const newNode: FileNode = {
          id, name, type, path,
          content: type === "file" ? content : undefined,
          language: type === "file" ? getLanguage(name) : undefined,
          children: type === "folder" ? [] : undefined,
        }
        let tree: FileNode[]
        if (parentPath === "" || parentPath === "/") {
          tree = [...get().fileTree, newNode]
        } else {
          tree = insertNodeAtPath(get().fileTree, parentPath, newNode)
        }
        const map = new Map<string, FileNode>()
        flattenTree(tree, map)
        set({ fileTree: tree, flatFiles: map, newItemParentId: null, newItemType: null })
        if (type === "file") get().openTab(newNode)
      },

      deleteNode: (path) => {
        const map = new Map<string, FileNode>()
        flattenTree(get().fileTree, map)
        const node = map.get(path)
        if (node) deleteAllFileContents([node])
        const tree = deleteNodeAtPath(get().fileTree, path)
        const newMap = new Map<string, FileNode>()
        flattenTree(tree, newMap)
        const openTabs = get().openTabs.filter((t) => !t.path.startsWith(path))
        const activeTabId = openTabs.find((t) => t.id === get().activeTabId)
          ? get().activeTabId
          : openTabs[openTabs.length - 1]?.id || null
        set({ fileTree: tree, flatFiles: newMap, openTabs, activeTabId })
      },

      renameNode: (path, newName) => {
        const parentPath = path.substring(0, path.lastIndexOf("/"))
        const newPath = `${parentPath}/${newName}`
        const node = get().flatFiles.get(path)
        const siblings = parentPath === "" || parentPath === "/"
          ? get().fileTree
          : get().flatFiles.get(parentPath)?.children || []
        if (!node || siblings.some((s) => s.path !== path && s.name.toLowerCase() === newName.trim().toLowerCase())) return
        renameFileContent(path, newPath)
        const tree = renameNodeAtPath(get().fileTree, path, newName, newPath)
        const map = new Map<string, FileNode>()
        flattenTree(tree, map)
        const openTabs = get().openTabs.map((t) => {
          if (t.path !== path && !t.path.startsWith(`${path}/`)) return t
          const nextPath = t.path === path ? newPath : `${newPath}${t.path.slice(path.length)}`
          return { ...t, path: nextPath, name: nextPath.split("/").pop() || t.name, language: getLanguage(nextPath) }
        })
        const expandedFolders = new Set(Array.from(get().expandedFolders).map((p) =>
          p === path ? newPath : p.startsWith(`${path}/`) ? `${newPath}${p.slice(path.length)}` : p
        ))
        set({ fileTree: tree, flatFiles: map, openTabs, expandedFolders, renameNodeId: null })
      },

      updateFileContent: (path, content) => {
        saveFileContent(path, content)
        const tree = updateContentAtPath(get().fileTree, path, content)
        const map = new Map<string, FileNode>()
        flattenTree(tree, map)
        const openTabs = get().openTabs.map((t) => t.path === path ? { ...t, modified: true } : t)
        set({ fileTree: tree, flatFiles: map, openTabs })
        if (get().settings.preview.autoRefresh) {
          const ext = path.split(".").pop()?.toLowerCase()
          if (["html", "css", "js", "jsx", "ts", "tsx"].includes(ext || "")) get().refreshPreview()
        }
      },

      moveNode: (fromPath, toFolderPath) => {
        const map = new Map<string, FileNode>()
        flattenTree(get().fileTree, map)
        const node = map.get(fromPath)
        if (!node) return
        if (node.type === "folder" && (toFolderPath === fromPath || toFolderPath.startsWith(`${fromPath}/`))) return
        const destination = map.get(toFolderPath)
        if (!destination || destination.type !== "folder") return
        if (destination.children?.some((child) => child.name.toLowerCase() === node.name.toLowerCase())) return
        const tree1 = deleteNodeAtPath(get().fileTree, fromPath)
        const newPath = `${toFolderPath}/${node.name}`
        const movedNode = rewriteNodePaths(node, fromPath, newPath)
        const tree2 = insertNodeAtPath(tree1, toFolderPath, movedNode)
        const newMap = new Map<string, FileNode>()
        flattenTree(tree2, newMap)
        const openTabs = get().openTabs.map((t) => {
          if (t.path !== fromPath && !t.path.startsWith(`${fromPath}/`)) return t
          const nextPath = t.path === fromPath ? newPath : `${newPath}${t.path.slice(fromPath.length)}`
          return { ...t, path: nextPath, name: nextPath.split("/").pop() || t.name }
        })
        const expandedFolders = new Set(Array.from(get().expandedFolders).map((p) =>
          p === fromPath ? newPath : p.startsWith(`${fromPath}/`) ? `${newPath}${p.slice(fromPath.length)}` : p
        ))
        set({ fileTree: tree2, flatFiles: newMap, openTabs, expandedFolders })
      },

      openTab: (node) => {
        const existing = get().openTabs.find((t) => t.path === node.path)
        if (existing) { set({ activeTabId: existing.id, activePanel: "editor" }); return }
        const tab: Tab = {
          id: generateId(), fileId: node.id, path: node.path, name: node.name,
          modified: false, language: node.language || getLanguage(node.name),
        }
        set({ openTabs: [...get().openTabs, tab], activeTabId: tab.id, activePanel: "editor" })
      },

      closeTab: (tabId) => {
        const tabs = get().openTabs.filter((t) => t.id !== tabId)
        const activeTabId = get().activeTabId === tabId
          ? tabs[tabs.length - 1]?.id || null
          : get().activeTabId
        set({ openTabs: tabs, activeTabId })
      },

      setActiveTab: (tabId) => set({ activeTabId: tabId }),

      markTabModified: (tabId, modified) => {
        set({ openTabs: get().openTabs.map((t) => t.id === tabId ? { ...t, modified } : t) })
      },

      setActivePanel: (panel) => set({ activePanel: panel }),

      setTerminalType: (type) => set({ terminalType: type }),

      addTerminalLine: (line) => {
        const newLine: TerminalLine = { ...line, id: generateId(), timestamp: Date.now() }
        set({ terminalLines: [...get().terminalLines.slice(-500), newLine] })
      },

      clearTerminal: () => set({
        terminalLines: [{ id: generateId(), type: "info", content: "Terminal cleared.", timestamp: Date.now() }],
      }),

      setTerminalInput: (input) => set({ terminalInput: input }),

      addAIChatMessage: (message) => {
        const msg: AIChatMessage = { ...message, id: generateId(), timestamp: Date.now() }
        set({ aiChatMessages: [...get().aiChatMessages.slice(-99), msg] })
      },

      clearAIChat: () => set({ aiChatMessages: [] }),
      setAIChatOpen: (open) => set({ aiChatOpen: open }),
      setAITyping: (typing) => set({ aiTyping: typing }),
      setPreviewContent: (html) => set({ previewContent: html }),
      refreshPreview: () => set((s) => ({ previewKey: s.previewKey + 1 })),
      setContextMenu: (menu) => set({ contextMenu: menu }),

      toggleFolder: (path) => {
        const expanded = new Set(get().expandedFolders)
        if (expanded.has(path)) expanded.delete(path)
        else expanded.add(path)
        set({ expandedFolders: expanded })
      },

      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setIsRunning: (running) => set({ isRunning: running }),
      setRenameNodeId: (id) => set({ renameNodeId: id }),
      setNewItem: (parentId, type) => set({ newItemParentId: parentId, newItemType: type }),

      updateSettings: (s) => set({ settings: { ...get().settings, ...s } }),
      updateEditorSettings: (s) => set({ settings: { ...get().settings, editor: { ...get().settings.editor, ...s } } }),
      updateAISettings: (s) => set({ settings: { ...get().settings, ai: { ...get().settings.ai, ...s } } }),
      updateStorageSettings: (s) => set({ settings: { ...get().settings, storage: { ...get().settings.storage, ...s } } }),
      updateGithubSettings: (s) => set({ settings: { ...get().settings, github: { ...get().settings.github, ...s } } }),
      updatePreviewSettings: (s) => set({ settings: { ...get().settings, preview: { ...get().settings.preview, ...s } } }),
      setShowSettings: (show) => set({ showSettings: show }),
      setSettingsTab: (tab) => set({ settingsTab: tab }),

       importFiles: (files, parentPath = "") => {
        if (!files.length) return
         const imported = parentPath ? rewriteImportedPaths(files, parentPath) : files
         const destination = parentPath ? get().flatFiles.get(parentPath) : undefined
         if (parentPath && (!destination || destination.type !== "folder")) return
         const existing = parentPath ? destination?.children || [] : get().fileTree
         const unique = imported.filter((node) => !existing.some((item) => item.name.toLowerCase() === node.name.toLowerCase()))
         saveAllFileContents(unique)
         const tree = parentPath
           ? replaceChildrenAtPath(get().fileTree, parentPath, [...existing, ...unique])
           : [...get().fileTree, ...unique]
        const map = new Map<string, FileNode>()
        flattenTree(tree, map)
         const expanded = new Set(get().expandedFolders)
         if (parentPath) expanded.add(parentPath)
         else if (unique[0]?.type === "folder") expanded.add(unique[0].path)
        set({ fileTree: tree, flatFiles: map, expandedFolders: expanded })
      },

      setDragOver: (id) => set({ dragOverId: id }),

      setTerminalBridgeCmd: (cmd) => set({ terminalBridgeCmd: cmd }),

      openInTerminal: (path, isFolder) => {
        const dirPath = isFolder
          ? path
          : path.lastIndexOf("/") > 0
          ? path.substring(0, path.lastIndexOf("/"))
          : "/"
        set({
          terminalBridgeCmd: { cmd: `cd ${dirPath}`, targetTab: "shell" },
          activePanel: "terminal",
          sidebarOpen: false,
        })
      },

      setErrors: (errors) => set({ errors }),
    }),
    {
      name: "sk-coder-ide-v3",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        fileTree: stripContent(state.fileTree),
        openTabs: state.openTabs,
        activeTabId: state.activeTabId,
        expandedFolders: Array.from(state.expandedFolders),
        settings: state.settings,
        terminalType: state.terminalType,
        aiChatMessages: state.aiChatMessages,
      }),
      merge: (persisted: unknown, current) => {
        const p = persisted as Partial<IDEState & { expandedFolders: string[] }>
        const rawTree = Array.isArray(p.fileTree) ? p.fileTree : []
        const restoredTree = restoreContent(rawTree)
        const map = new Map<string, FileNode>()
        flattenTree(restoredTree, map)
        return {
          ...current,
          ...p,
          fileTree: restoredTree,
          flatFiles: map,
          expandedFolders: new Set(Array.isArray(p.expandedFolders) ? p.expandedFolders : []),
          terminalLines: INIT_LINES,
          previewContent: "",
          contextMenu: null,
          aiTyping: false,
          isRunning: false,
          aiChatMessages: Array.isArray(p.aiChatMessages) ? p.aiChatMessages : [],
        }
      },
    }
  )
)

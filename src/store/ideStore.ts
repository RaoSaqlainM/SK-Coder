import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import type { ActivePanel, AIChatMessage, ErrorEntry, FileNode, Settings, Tab, TerminalLine, TerminalType } from "@/types/ide"
import { generateId, getLanguageFromExtension } from "@/types/ide"
import { nodeToZipBlob } from "@/lib/shareProject"

type ContextMenuState = { x: number; y: number; node: FileNode | null } | null
type EditorTarget = { path: string; lineNumber: number; columnNumber?: number } | null

type State = {
  fileTree: FileNode[]
  openTabs: Tab[]
  activeTabId: string | null
  activePanel: ActivePanel
  terminalType: TerminalType
  terminalLines: TerminalLine[]
  terminalInput: string
  previewUrl: string
  previewKey: number
  contextMenu: ContextMenuState
  expandedFolders: Set<string>
  sidebarOpen: boolean
  isRunning: boolean
  settings: Settings
  searchQuery: string
  editorTarget: EditorTarget
  errors: ErrorEntry[]
  aiChatMessages: AIChatMessage[]
  aiChatOpen: boolean
  aiTyping: boolean
  showSettings: boolean
  settingsTab: string
  terminalBridgeCmd: { cmd: string; targetTab?: string } | null
}

type Actions = {
  setFileTree: (tree: FileNode[]) => void
  addFileNode: (parentPath: string, node: FileNode) => void
  addFile: (parentPath: string, name: string, type: "file" | "folder", content?: string) => void
  deleteFileNode: (path: string) => void
  deleteNode: (path: string) => void
  renameNode: (path: string, newName: string) => void
  moveNode: (fromPath: string, destinationPath: string) => void
  openFile: (node: FileNode) => void
  openTab: (node: FileNode) => void
  closeTab: (tabId: string) => void
  closeAllTabs: () => void
  closeOtherTabs: (tabId: string) => void
  setActiveTab: (tabId: string) => void
  updateTabContent: (tabId: string, content: string) => void
  updateFileContent: (path: string, content: string) => void
  getActiveFile: () => FileNode | undefined
  setActivePanel: (panel: ActivePanel) => void
  setTerminalType: (type: TerminalType) => void
  addTerminalLine: (line: Omit<TerminalLine, "id" | "timestamp">) => void
  clearTerminal: () => void
  setTerminalInput: (value: string) => void
  setPreviewUrl: (url: string) => void
  refreshPreview: () => void
  setContextMenu: (value: ContextMenuState) => void
  toggleFolder: (path: string) => void
  setSidebarOpen: (value: boolean) => void
  toggleSidebar: () => void
  setIsRunning: (value: boolean) => void
  updateSettings: (value: Partial<Settings>) => void
  setSearchQuery: (value: string) => void
  setEditorTarget: (value: EditorTarget) => void
  setErrors: (value: ErrorEntry[]) => void
  setAiChatOpen: (value: boolean) => void
  setAITyping: (value: boolean) => void
  addAIChatMessage: (value: Omit<AIChatMessage, "id" | "timestamp">) => void
  clearAIChat: () => void
  setShowSettings: (value: boolean) => void
  setSettingsTab: (value: string) => void
  setTerminalBridgeCmd: (value: { cmd: string; targetTab?: string } | null) => void
  renameFileNode: (path: string, newName: string) => void
  downloadProject: () => Promise<void>
}

const defaults: Settings = {
  editor: { fontSize: 14, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", tabSize: 2, wordWrap: "on", minimap: false, lineNumbers: "on", autoSave: true, theme: "vs-dark", bracketPairs: true, smoothScrolling: true, cursorStyle: "line", renderWhitespace: "none" },
  ai: { apiKey: "", apiEndpoint: "", model: "", keyStatus: "none", autoContext: true, autoAnalyze: false, usePuter: false },
  storage: { workspacePath: "", useExternalStorage: false, sdCardPath: "/sdcard/SKCoder", downloadPath: "", mobileWorkspacePath: "", browserDownloadPath: "" },
  github: { token: "", username: "", codespaceActive: "" },
  preview: { viewport: "mobile", autoRefresh: true, port: "3000", showErrors: true },
  piston: { serverUrl: "https://emkc.org/api/v2/piston" },
  backend: { url: "", enabled: true }
}

function mergeSettings(settings?: Partial<Settings>): Settings {
  return {
    ...defaults,
    ...settings,
    editor: { ...defaults.editor, ...settings?.editor },
    ai: { ...defaults.ai, ...settings?.ai },
    storage: { ...defaults.storage, ...settings?.storage },
    github: { ...defaults.github, ...settings?.github },
    preview: { ...defaults.preview, ...settings?.preview },
    piston: { ...defaults.piston, ...settings?.piston },
    backend: { ...defaults.backend, ...settings?.backend }
  }
}

function clonePath(nodes: FileNode[], path: string, mapper: (node: FileNode) => FileNode | null): FileNode[] {
  return nodes.flatMap((node) => {
    if (node.path === path) {
      const next = mapper(node)
      return next ? [next] : []
    }
    if (!node.children) return [node]
    return [{ ...node, children: clonePath(node.children, path, mapper) }]
  })
}

function findNode(nodes: FileNode[], path: string): FileNode | undefined {
  for (const node of nodes) {
    if (node.path === path) return node
    const result = node.children ? findNode(node.children, path) : undefined
    if (result) return result
  }
}

function withoutPath(nodes: FileNode[], path: string): FileNode[] {
  return nodes.filter((node) => node.path !== path).map((node) => node.children ? { ...node, children: withoutPath(node.children, path) } : node)
}

function insertAt(nodes: FileNode[], parentPath: string, node: FileNode): FileNode[] {
  if (!parentPath || parentPath === "/") return [...nodes, node]
  return nodes.map((entry) => entry.path === parentPath && entry.type === "folder" ? { ...entry, children: [...(entry.children ?? []), node] } : entry.children ? { ...entry, children: insertAt(entry.children, parentPath, node) } : entry)
}

function rebasePath(path: string, fromPath: string, toPath: string): string {
  if (path === fromPath) return toPath
  return path.startsWith(`${fromPath}/`) ? `${toPath}${path.slice(fromPath.length)}` : path
}

function rebaseNode(node: FileNode, fromPath: string, toPath: string): FileNode {
  return {
    ...node,
    path: rebasePath(node.path, fromPath, toPath),
    children: node.children?.map((child) => rebaseNode(child, fromPath, toPath))
  }
}

function rebaseFolders(folders: Set<string>, fromPath: string, toPath: string): Set<string> {
  return new Set([...folders].map((path) => rebasePath(path, fromPath, toPath)))
}

export const useIDEStore = create<State & Actions>()(persist((set, get) => ({
  fileTree: [], openTabs: [], activeTabId: null, activePanel: "editor", terminalType: "shell", terminalLines: [{ id: "welcome", text: "SK Terminal ready. Type help for local workspace commands.", type: "info", timestamp: Date.now() }], terminalInput: "", previewUrl: "", previewKey: 0, contextMenu: null, expandedFolders: new Set(), sidebarOpen: true, isRunning: false, settings: defaults, searchQuery: "", editorTarget: null, errors: [], aiChatMessages: [], aiChatOpen: false, aiTyping: false, showSettings: false, settingsTab: "editor", terminalBridgeCmd: null,
  setFileTree: (fileTree) => set({ fileTree }),
  addFileNode: (parentPath, node) => set((state) => findNode(state.fileTree, node.path) ? {} : { fileTree: insertAt(state.fileTree, parentPath, node) }),
  addFile: (parentPath, name, type, content = "") => {
    const path = parentPath ? `${parentPath.replace(/\/$/, "")}/${name}` : `/${name}`
    const node: FileNode = { id: generateId(), name, type, path, content: type === "file" ? content : undefined, language: type === "file" ? getLanguageFromExtension(name) : undefined, children: type === "folder" ? [] : undefined }
    get().addFileNode(parentPath, node)
    if (type === "file") get().openFile(node)
  },
  deleteFileNode: (path) => {
    set((state) => {
      const openTabs = state.openTabs.filter((tab) => !tab.path.startsWith(path))
      return { fileTree: withoutPath(state.fileTree, path), openTabs, activeTabId: openTabs.some((tab) => tab.id === state.activeTabId) ? state.activeTabId : openTabs.at(-1)?.id ?? null }
    })
  },
  deleteNode: (path) => get().deleteFileNode(path),
  renameNode: (path, newName) => {
    const original = findNode(get().fileTree, path)
    if (!original) return
    const safeName = newName.trim().replace(/[\\/]/g, "")
    if (!safeName) return
    const parent = path.slice(0, path.lastIndexOf("/"))
    const nextPath = `${parent}/${safeName}`
    if (nextPath !== path && findNode(get().fileTree, nextPath)) return
    set((state) => ({
      fileTree: clonePath(state.fileTree, path, (node) => ({ ...rebaseNode(node, path, nextPath), name: safeName })),
      openTabs: state.openTabs.map((tab) => tab.path.startsWith(path) ? {
        ...tab,
        path: rebasePath(tab.path, path, nextPath),
        name: tab.path === path ? safeName : tab.name,
        language: tab.path === path ? getLanguageFromExtension(safeName) : tab.language
      } : tab),
      expandedFolders: rebaseFolders(state.expandedFolders, path, nextPath)
    }))
  },
  moveNode: (fromPath, destinationPath) => {
    const node = findNode(get().fileTree, fromPath)
    if (!node || node.type === "folder" && destinationPath.startsWith(`${node.path}/`)) return
    const nextPath = `${destinationPath.replace(/\/$/, "")}/${node.name}`
    if (nextPath !== fromPath && findNode(get().fileTree, nextPath)) return
    const moved = rebaseNode(node, fromPath, nextPath)
    set((state) => ({
      fileTree: insertAt(withoutPath(state.fileTree, fromPath), destinationPath, moved),
      openTabs: state.openTabs.map((tab) => tab.path.startsWith(fromPath) ? { ...tab, path: rebasePath(tab.path, fromPath, nextPath) } : tab),
      expandedFolders: rebaseFolders(state.expandedFolders, fromPath, nextPath)
    }))
  },
  openFile: (node) => {
    if (node.type !== "file") return
    const existing = get().openTabs.find((tab) => tab.path === node.path)
    if (existing) { set({ activeTabId: existing.id, activePanel: "editor" }); return }
    const tab: Tab = { id: generateId(), fileId: node.id, path: node.path, name: node.name, language: node.language ?? getLanguageFromExtension(node.name), content: node.content ?? "", modified: false, isDirty: false }
    set((state) => ({ openTabs: [...state.openTabs, tab], activeTabId: tab.id, activePanel: "editor" }))
  },
  openTab: (node) => get().openFile(node),
  closeTab: (tabId) => set((state) => { const openTabs = state.openTabs.filter((tab) => tab.id !== tabId); return { openTabs, activeTabId: state.activeTabId === tabId ? openTabs.at(-1)?.id ?? null : state.activeTabId } }),
  closeAllTabs: () => set({ openTabs: [], activeTabId: null }),
  closeOtherTabs: (tabId) => set((state) => ({ openTabs: state.openTabs.filter((tab) => tab.id === tabId), activeTabId: tabId })),
  setActiveTab: (activeTabId) => set({ activeTabId }),
  updateTabContent: (tabId, content) => set((state) => ({ openTabs: state.openTabs.map((tab) => tab.id === tabId ? { ...tab, content, modified: true, isDirty: true } : tab) })),
  updateFileContent: (path, content) => set((state) => ({ fileTree: clonePath(state.fileTree, path, (node) => ({ ...node, content })), openTabs: state.openTabs.map((tab) => tab.path === path ? { ...tab, content, modified: true, isDirty: true } : tab), previewKey: state.settings.preview.autoRefresh ? state.previewKey + 1 : state.previewKey })),
  getActiveFile: () => { const tab = get().openTabs.find((item) => item.id === get().activeTabId); return tab ? { id: tab.fileId, name: tab.name, type: "file", path: tab.path, content: tab.content, language: tab.language } : undefined },
  setActivePanel: (activePanel) => set({ activePanel }),
  setTerminalType: (terminalType) => set({ terminalType }),
  addTerminalLine: (line) => set((state) => ({ terminalLines: [...state.terminalLines.slice(-499), { ...line, id: generateId(), timestamp: Date.now() }] })),
  clearTerminal: () => set({ terminalLines: [] }),
  setTerminalInput: (terminalInput) => set({ terminalInput }),
  setPreviewUrl: (previewUrl) => set({ previewUrl }),
  refreshPreview: () => set((state) => ({ previewKey: state.previewKey + 1 })),
  setContextMenu: (contextMenu) => set({ contextMenu }),
  toggleFolder: (path) => set((state) => { const expandedFolders = new Set(state.expandedFolders); expandedFolders.has(path) ? expandedFolders.delete(path) : expandedFolders.add(path); return { expandedFolders } }),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setIsRunning: (isRunning) => set({ isRunning }),
  updateSettings: (value) => set((state) => ({ settings: { ...state.settings, ...value } })),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setEditorTarget: (editorTarget) => set({ editorTarget }),
  setErrors: (errors) => set({ errors }),
  setAiChatOpen: (aiChatOpen) => set({ aiChatOpen }),
  setAITyping: (aiTyping) => set({ aiTyping }),
  addAIChatMessage: (message) => set((state) => ({ aiChatMessages: [...state.aiChatMessages.slice(-99), { ...message, id: generateId(), timestamp: Date.now() }] })),
  clearAIChat: () => set({ aiChatMessages: [] }),
  setShowSettings: (showSettings) => set({ showSettings }),
  setSettingsTab: (settingsTab) => set({ settingsTab }),
  setTerminalBridgeCmd: (terminalBridgeCmd) => set({ terminalBridgeCmd }),
  renameFileNode: (path, newName) => get().renameNode(path, newName),
  downloadProject: async () => {
    const root: FileNode = { id: "workspace", name: "sk-coder-project", type: "folder", path: "/", children: get().fileTree }
    const blob = await nodeToZipBlob(root)
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = "sk-coder-project.zip"
    anchor.click()
    URL.revokeObjectURL(url)
  }
}), {
  name: "sk-coder-phase-one",
  storage: createJSONStorage(() => localStorage),
  partialize: (state) => ({ fileTree: state.fileTree, openTabs: state.openTabs, activeTabId: state.activeTabId, settings: state.settings, expandedFolders: [...state.expandedFolders], aiChatMessages: state.aiChatMessages }),
  merge: (persistedState, currentState) => {
    const persisted = persistedState as Partial<State>
    return { ...currentState, ...persisted, settings: mergeSettings(persisted.settings), expandedFolders: new Set(persisted.expandedFolders ?? []) }
  }
}))

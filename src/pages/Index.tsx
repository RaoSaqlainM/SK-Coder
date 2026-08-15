import { lazy, Suspense, useEffect, useState } from "react"
import { useIDEStore } from "@/store/ideStore"
import { loadWorkspaceSnapshot, saveWorkspaceSnapshot } from "@/lib/storageManager"
import TopBar from "@/components/ide/TopBar"
import FileExplorer from "@/components/ide/FileExplorer"
import EditorTabs from "@/components/ide/EditorTabs"
const CodeEditor = lazy(() => import("@/components/ide/CodeEditor"))
const Terminal = lazy(() => import("@/components/ide/Terminal"))
const PreviewPane = lazy(() => import("@/components/ide/PreviewPane"))
const AIChatPanel = lazy(() => import("@/components/ide/AIChatPanel"))
const SettingsPanel = lazy(() => import("@/components/ide/SettingsPanel"))
const GitPanel = lazy(() => import("@/components/ide/GitPanel"))
const ContextMenu = lazy(() => import("@/components/ide/ContextMenu"))
import BottomNav from "@/components/ide/BottomNav"
import StatusBar from "@/components/ide/StatusBar"
import ProblemsPanel from "@/components/ide/ProblemsPanel"

export default function Index() {
  const { activePanel, sidebarOpen, addFile, fileTree } = useIDEStore()
  const [workspaceReady, setWorkspaceReady] = useState(false)
  useEffect(() => {
    let active = true
    void loadWorkspaceSnapshot().then((snapshot) => {
      if (active && snapshot?.tree.length) useIDEStore.getState().setFileTree(snapshot.tree)
    }).catch(() => undefined).finally(() => {
      if (active) setWorkspaceReady(true)
    })
    return () => { active = false }
  }, [])
  useEffect(() => {
    if (workspaceReady && !fileTree.length) addFile("", "index.html", "file", "<!doctype html>\n<html><head><meta charset=\"UTF-8\"><title>SK Coder</title></head><body><main><h1>SK Coder</h1><p>Your mobile-first workspace is ready.</p></main></body></html>\n")
  }, [addFile, fileTree.length, workspaceReady])
  useEffect(() => {
    if (!workspaceReady) return
    const timer = window.setTimeout(() => { void saveWorkspaceSnapshot(fileTree).catch(() => undefined) }, 350)
    return () => window.clearTimeout(timer)
  }, [fileTree, workspaceReady])
  const fallback = <div className="h-full bg-editor-bg" />
  const panel = <Suspense fallback={fallback}>{activePanel === "files" ? <div className="h-full md:hidden"><FileExplorer /></div> : activePanel === "terminal" ? <Terminal /> : activePanel === "preview" ? <PreviewPane /> : activePanel === "ai" ? <AIChatPanel /> : activePanel === "settings" ? <SettingsPanel /> : activePanel === "git" ? <GitPanel /> : <div className="flex h-full flex-col"><EditorTabs /><div className="min-h-0 flex-1"><CodeEditor /></div><ProblemsPanel /></div>}</Suspense>
  return <div className="h-[100dvh] min-h-[600px] flex flex-col overflow-hidden bg-[#1e1e1e] text-[#d4d4d4]"><TopBar /><div className="flex min-h-0 flex-1"><aside className={`${sidebarOpen ? "md:flex" : "md:hidden"} hidden w-64 shrink-0 border-r border-[#333]`}><FileExplorer /></aside><main className="min-w-0 flex-1 overflow-hidden">{panel}</main></div><BottomNav /><StatusBar /><Suspense fallback={null}><ContextMenu /></Suspense></div>
}

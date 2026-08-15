import { useEffect } from "react"
import { useIDEStore } from "@/store/ideStore"
import TopBar from "@/components/ide/TopBar"
import FileExplorer from "@/components/ide/FileExplorer"
import EditorTabs from "@/components/ide/EditorTabs"
import CodeEditor from "@/components/ide/CodeEditor"
import Terminal from "@/components/ide/Terminal"
import PreviewPane from "@/components/ide/PreviewPane"
import AIChatPanel from "@/components/ide/AIChatPanel"
import SettingsPanel from "@/components/ide/SettingsPanel"
import ContextMenu from "@/components/ide/ContextMenu"
import BottomNav from "@/components/ide/BottomNav"
import StatusBar from "@/components/ide/StatusBar"
import ProblemsPanel from "@/components/ide/ProblemsPanel"

export default function Index() {
  const { activePanel, sidebarOpen, addFile, fileTree } = useIDEStore()
  useEffect(() => { if (!fileTree.length) addFile("", "index.html", "file", "<!doctype html>\n<html><head><meta charset=\"UTF-8\"><title>SK Coder</title></head><body><main><h1>SK Coder</h1><p>Your mobile-first workspace is ready.</p></main></body></html>\n") }, [addFile, fileTree.length])
  const panel = activePanel === "files" ? <div className="h-full md:hidden"><FileExplorer /></div> : activePanel === "terminal" ? <Terminal /> : activePanel === "preview" ? <PreviewPane /> : activePanel === "ai" ? <AIChatPanel /> : activePanel === "settings" ? <SettingsPanel /> : <div className="flex h-full flex-col"><EditorTabs /><div className="min-h-0 flex-1"><CodeEditor /></div><ProblemsPanel /></div>
  return <div className="h-[100dvh] min-h-[600px] flex flex-col overflow-hidden bg-[#1e1e1e] text-[#d4d4d4]"><TopBar /><div className="flex min-h-0 flex-1"><aside className={`${sidebarOpen ? "md:flex" : "md:hidden"} hidden w-64 shrink-0 border-r border-[#333]`}><FileExplorer /></aside><main className="min-w-0 flex-1 overflow-hidden">{panel}</main></div><BottomNav /><StatusBar /><ContextMenu /></div>
}

import { useIDEStore } from "@/store/ideStore";
import { getFileSize } from "@/types/ide";

export default function StatusBar() {
  const { openTabs, activeTabId, isRunning, fileTree, settings } = useIDEStore();
  const activeTab = openTabs.find((t) => t.id === activeTabId);

  const countFiles = (nodes: typeof fileTree): number =>
    nodes.reduce((acc, n) => acc + (n.type === "file" ? 1 : 0) + (n.children ? countFiles(n.children) : 0), 0);

  const totalFiles = countFiles(fileTree);

  return (
    <div className="hidden sm:flex items-center justify-between bg-statusbar-bg text-statusbar-fg px-3 h-6 text-[10px] shrink-0 select-none">
      <div className="flex items-center gap-3">
        {isRunning && <span className="animate-pulse flex items-center gap-1">● Running</span>}
        <span className="flex items-center gap-1.5">
          <img src="/saqlain.jpg" alt="SK" className="w-3.5 h-3.5 rounded-full object-cover ring-1 ring-primary/40" onError={(e) => { (e.target as HTMLImageElement).style.display="none"; }} />
          <span className="font-medium">SK Coder</span>
        </span>
      </div>
      <div className="flex items-center gap-3">
        {activeTab && (
          <>
            <span className="uppercase">{activeTab.language}</span>
            <span>Ln {activeTab.content.split("\n").length}, Col 1</span>
            <span>{getFileSize(activeTab.content)}</span>
            <span>Tab: {settings.editor.tabSize}</span>
            <span>UTF-8</span>
          </>
        )}
        <span>{totalFiles} file{totalFiles !== 1 ? "s" : ""}</span>
      </div>
    </div>
  );
}

import { X } from "lucide-react";
import { useIDEStore } from "@/store/ideStore";
import { cn } from "@/lib/utils";
import { useCallback } from "react";

export default function EditorTabs() {
  const { openTabs, activeTabId, setActiveTab, closeTab, closeAllTabs, closeOtherTabs, setContextMenu } = useIDEStore();

  const handleClose = useCallback((e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    closeTab(tabId);
  }, [closeTab]);

  if (openTabs.length === 0) return null;

  return (
    <div className="flex items-center bg-[hsl(var(--tab-inactive))] overflow-x-auto no-scrollbar border-b border-border h-9 shrink-0">
      {openTabs.map((tab) => (
        <div
          key={tab.id}
          className={cn(
            "flex items-center gap-1.5 px-3 h-full text-xs cursor-pointer border-r border-border/50 transition-colors group min-w-0 relative",
            tab.id === activeTabId
              ? "bg-[hsl(var(--tab-active))] text-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/30"
          )}
          onClick={() => setActiveTab(tab.id)}
        >
          {tab.id === activeTabId && (
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-primary" />
          )}
          {tab.isDirty && (
            <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
          )}
          <span className="truncate max-w-[120px]">{tab.name}</span>
          <button
            className="ml-0.5 p-0.5 rounded hover:bg-secondary/80 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
            onClick={(e) => handleClose(e, tab.id)}
            aria-label={`Close ${tab.name}`}
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  );
}

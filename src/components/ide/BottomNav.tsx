import { useIDEStore } from "@/store/ideStore";
import { FolderOpen, Code, Eye, TerminalSquare, Settings } from "lucide-react";
import type { ActivePanel } from "@/types/ide";
import { cn } from "@/lib/utils";

const navItems: { panel: ActivePanel; icon: typeof Code; label: string }[] = [
  { panel: "files", icon: FolderOpen, label: "Files" },
  { panel: "editor", icon: Code, label: "Editor" },
  { panel: "preview", icon: Eye, label: "Preview" },
  { panel: "terminal", icon: TerminalSquare, label: "Terminal" },
  { panel: "settings", icon: Settings, label: "Settings" },
];

export default function BottomNav() {
  const { activePanel, setActivePanel } = useIDEStore();

  return (
    <nav className="flex items-stretch justify-around bg-card border-t border-border h-14 shrink-0">
      {navItems.map(({ panel, icon: Icon, label }) => (
        <button
          key={panel}
          onClick={() => setActivePanel(panel)}
          className={cn(
            "flex flex-col items-center justify-center gap-0.5 flex-1 transition-colors relative",
            activePanel === panel
              ? "text-primary"
              : "text-muted-foreground active:text-foreground"
          )}
        >
          {activePanel === panel && (
            <div className="absolute top-0 left-1/4 right-1/4 h-[2px] bg-primary rounded-b" />
          )}
          <Icon className="w-5 h-5" />
          <span className="text-[10px] font-medium">{label}</span>
        </button>
      ))}
    </nav>
  );
}

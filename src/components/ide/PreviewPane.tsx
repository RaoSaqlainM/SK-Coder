import { useState, useEffect, useCallback } from "react";
import { useIDEStore } from "@/store/ideStore";
import { Monitor, Smartphone, Tablet, ExternalLink, RefreshCw, Share2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { buildHtmlPreview, htmlToDataUrl } from "@/lib/previewBuilder";

export default function PreviewPane() {
  const { previewUrl, openTabs, activeTabId, settings, previewKey, setErrors, setActivePanel, fileTree } = useIDEStore();
  const [viewport, setViewport] = useState<"mobile" | "tablet" | "desktop">(settings.preview.viewport);
  const [refreshKey, setRefreshKey] = useState(0);
  const [copied, setCopied] = useState(false);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const activeTab = openTabs.find((t) => t.id === activeTabId);

  const getPreviewContent = useCallback(() => {
    if (previewUrl) return previewUrl;
    if (!activeTab) return null;

    const ext = activeTab.name.split(".").pop()?.toLowerCase();
    if (ext === "html") {
      return htmlToDataUrl(buildHtmlPreview({ id: activeTab.fileId, name: activeTab.name, path: activeTab.path, type: "file", content: activeTab.content, language: activeTab.language }, fileTree));
    }
    if (ext === "css") {
      return `data:text/html;charset=utf-8,${encodeURIComponent(
        `<!DOCTYPE html><html><head><style>${activeTab.content}</style></head><body><div style="padding:20px;font-family:system-ui"><h1>CSS Preview</h1><p>Your styles are applied to this page.</p><button>Button</button><input type="text" placeholder="Input field"><ul><li>List item 1</li><li>List item 2</li></ul></div></body></html>`
      )}`;
    }
    if (ext === "md") {
      const escaped = activeTab.content
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/^### (.+)$/gm, "<h3>$1</h3>")
        .replace(/^## (.+)$/gm, "<h2>$1</h2>")
        .replace(/^# (.+)$/gm, "<h1>$1</h1>")
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.+?)\*/g, "<em>$1</em>")
        .replace(/`(.+?)`/g, "<code>$1</code>")
        .replace(/\n/g, "<br>");
      return `data:text/html;charset=utf-8,${encodeURIComponent(
        `<!DOCTYPE html><html><head><style>body{font-family:system-ui,-apple-system,sans-serif;padding:24px;color:#d4d4d8;background:#1e1e2e;max-width:720px;margin:0 auto;line-height:1.7}code{background:#11111b;padding:2px 6px;border-radius:3px;font-size:0.9em}h1,h2,h3{color:#cdd6f4;margin-top:1.5em}a{color:#89b4fa}</style></head><body>${escaped}</body></html>`
      )}`;
    }
    if (ext === "svg") {
      return `data:text/html;charset=utf-8,${encodeURIComponent(
        `<!DOCTYPE html><html><head><style>body{display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#1e1e2e}</style></head><body>${activeTab.content}</body></html>`
      )}`;
    }
    return null;
  }, [previewUrl, activeTab, fileTree]);

  const previewSrc = getPreviewContent();
  const viewportWidths = { mobile: "375px", tablet: "768px", desktop: "100%" };

  useEffect(() => {
    if (settings.preview.autoRefresh && previewSrc) {
      setRefreshKey((k) => k + 1);
    }
  }, [activeTab?.content, previewKey, previewSrc, settings.preview.autoRefresh]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent<{ source?: string; message?: string; line?: number; column?: number }>) => {
      if (event.data?.source !== "sk-coder-preview") return;
      const message = event.data.message || "Preview runtime error.";
      setRuntimeError(message);
      if (activeTab) setErrors([...useIDEStore.getState().errors.filter((error) => error.file !== activeTab.path || error.message !== message), { id: `preview-${activeTab.path}-${Date.now()}`, file: activeTab.path, line: event.data.line || 1, col: event.data.column, message, severity: "error" }]);
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [activeTab, setErrors]);

  useEffect(() => setRuntimeError(null), [previewSrc, refreshKey]);

  const handleShare = useCallback(async () => {
    if (!previewSrc) return;
    const text = previewSrc.startsWith("data:") ? previewSrc : window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: activeTab?.name || "SK Coder Preview", text });
      else await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }, [previewSrc, activeTab?.name]);

  return (
    <div className="h-full flex flex-col bg-editor-bg">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border shrink-0 gap-2">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Preview</span>
        <div className="flex items-center gap-0.5">
          {(
            [
              { mode: "mobile" as const, icon: Smartphone, label: "375px" },
              { mode: "tablet" as const, icon: Tablet, label: "768px" },
              { mode: "desktop" as const, icon: Monitor, label: "100%" },
            ] as const
          ).map(({ mode, icon: Icon }) => (
            <button
              key={mode}
              onClick={() => setViewport(mode)}
              className={cn(
                "p-1.5 rounded transition-colors",
                viewport === mode ? "bg-primary text-primary-foreground" : "hover:bg-secondary text-muted-foreground"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
            </button>
          ))}
          <div className="w-px h-4 bg-border mx-1" />
          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            className="p-1.5 rounded hover:bg-secondary text-muted-foreground transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleShare}
            className="p-1.5 rounded hover:bg-secondary text-muted-foreground transition-colors"
          >
            <Share2 className="w-3.5 h-3.5" />
          </button>
          {previewSrc && (
            <button
              onClick={() => window.open(previewSrc, "_blank")}
              className="p-1.5 rounded hover:bg-secondary text-muted-foreground transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
      {copied && (
        <div className="bg-success/20 text-success text-[11px] text-center py-1">
          Preview link copied
        </div>
      )}
      {runtimeError && settings.preview.showErrors && <div className="flex items-center justify-between gap-2 border-b border-destructive/30 bg-destructive/10 px-3 py-1.5 text-[11px] text-destructive"><span className="truncate">Preview error: {runtimeError}</span><button type="button" onClick={() => setActivePanel("editor")} className="shrink-0 font-medium underline">View Problems</button></div>}
      <div className="flex-1 flex items-start justify-center overflow-auto p-2 bg-terminal-bg">
        {previewSrc ? (
          <iframe
            key={refreshKey}
            src={previewSrc}
            className="bg-background border border-border rounded-md shadow-lg"
            style={{
              width: viewportWidths[viewport],
              height: "100%",
              maxWidth: "100%",
            }}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
            title="Preview"
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
            <AlertTriangle className="w-12 h-12 opacity-15" />
            <p className="text-sm font-medium">No preview available</p>
            <p className="text-xs text-muted-foreground/60 text-center max-w-[240px]">
              Open an HTML file or click Run to preview your project
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

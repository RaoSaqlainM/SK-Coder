import { useEffect, useState } from "react"
import { AlertTriangle, ChevronDown, ChevronRight, CircleAlert } from "lucide-react"
import { useIDEStore } from "@/store/ideStore"

export default function ProblemsPanel() {
  const { errors, settings, openTabs, openFile, setActivePanel, setEditorTarget } = useIDEStore()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (settings.preview.showErrors && errors.length) setOpen(true)
  }, [errors.length, settings.preview.showErrors])

  if (!settings.preview.showErrors) return null

  return (
    <div className="shrink-0 border-t border-border bg-card/50">
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex h-8 w-full items-center gap-2 px-3 text-left text-[11px] text-muted-foreground hover:bg-secondary/40">
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        <AlertTriangle className={`h-3.5 w-3.5 ${errors.length ? "text-destructive" : "text-muted-foreground"}`} />
        <span className="font-medium">Problems</span>
        <span>{errors.length ? `${errors.length} issue${errors.length === 1 ? "" : "s"}` : "No issues"}</span>
      </button>
      {open && <div className="max-h-40 overflow-y-auto border-t border-border font-mono text-xs">
        {errors.length ? errors.map((error) => <button key={error.id} type="button" onClick={() => {
          const tab = openTabs.find((item) => item.path === error.file)
          if (tab) {
            openFile({ id: tab.fileId, name: tab.name, type: "file", path: tab.path, content: tab.content, language: tab.language })
            setEditorTarget({ path: tab.path, lineNumber: error.line, columnNumber: error.col })
            setActivePanel("editor")
          }
        }} className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-secondary/40">
          <CircleAlert className={error.severity === "error" ? "mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" : error.severity === "warning" ? "mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" : "mt-0.5 h-3.5 w-3.5 shrink-0 text-info"} />
          <span className="min-w-0 flex-1 whitespace-pre-wrap text-muted-foreground">{error.file ? `${error.file}:${error.line}${error.col ? `:${error.col}` : ""} ` : ""}{error.message}</span>
        </button>) : <p className="px-3 py-2 text-muted-foreground">No diagnostics are available for the current workspace.</p>}
      </div>}
    </div>
  )
}

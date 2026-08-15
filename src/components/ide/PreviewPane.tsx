import { useRef, useEffect, useState } from "react"
import { useIDEStore } from "@/store/ideStore"
import { buildPreview } from "@/lib/previewBuilder"
import type { PreviewViewport } from "@/types/ide"

type ViewportConfig = {
  label: string
  width: number
  height: number
  detail: string
}

const viewportConfig: Record<PreviewViewport, ViewportConfig> = {
  mobile: { label: "Mobile", width: 390, height: 844, detail: "390 × 844" },
  tablet: { label: "Tablet", width: 768, height: 1024, detail: "768 × 1024" },
  desktop: { label: "Desktop", width: 0, height: 0, detail: "Responsive" },
}

function RefreshIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 11a8 8 0 1 0 1 4" /><polyline points="20 4 20 11 13 11" /></svg>
}

function ExternalIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 3h7v7" /><path d="M10 14 21 3" /><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" /></svg>
}

function BrowserIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M7 6.5h.01M10 6.5h.01" /></svg>
}

export default function PreviewPane() {
  const { fileTree, previewKey, settings, updatePreviewSettings, getActiveFile, addTerminalLine } = useIDEStore()
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const [externalUrl, setExternalUrl] = useState("")
  const [liveUrl, setLiveUrl] = useState("")
  const [showExternal, setShowExternal] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [previewScale, setPreviewScale] = useState(1)

  const viewport = settings.preview.viewport
  const activeFile = getActiveFile()
  const cfg = viewportConfig[viewport]

  function buildAndSet() {
    if (showExternal) return
    const html = buildPreview(fileTree, activeFile?.path)
    if (iframeRef.current) {
      iframeRef.current.srcdoc = html
      setLoadError(false)
    }
  }

  useEffect(() => { buildAndSet() }, [previewKey, fileTree, showExternal])

  useEffect(() => {
    function handleResize() {
      if (!stageRef.current || viewport === "desktop") {
        setPreviewScale(1)
        return
      }
      const bounds = stageRef.current.getBoundingClientRect()
      const availableWidth = Math.max(0, bounds.width - 32)
      const availableHeight = Math.max(0, bounds.height - 56)
      setPreviewScale(Math.min(1, availableWidth / cfg.width, availableHeight / cfg.height))
    }
    handleResize()
    const observer = new ResizeObserver(handleResize)
    if (stageRef.current) observer.observe(stageRef.current)
    window.addEventListener("resize", handleResize)
    return () => {
      observer.disconnect()
      window.removeEventListener("resize", handleResize)
    }
  }, [viewport, cfg.width, cfg.height])

  useEffect(() => {
    function handle(e: MessageEvent) {
      if (e.data?.type === "console") {
        const level = e.data.level || "log"
        const msg = (e.data.args as string[]).join(" ")
        addTerminalLine({ type: level === "error" ? "error" : "output", content: `[preview] ${msg}` })
      }
      if (e.data?.type === "error") {
        addTerminalLine({ type: "error", content: `[preview] ${e.data.message} (line ${e.data.line})` })
      }
    }
    window.addEventListener("message", handle)
    return () => window.removeEventListener("message", handle)
  }, [addTerminalLine])

  function handleRefresh() {
    if (showExternal && iframeRef.current && liveUrl) iframeRef.current.src = liveUrl
    else buildAndSet()
  }

  function handleGoUrl() {
    const url = externalUrl.trim()
    if (!url) return
    const full = url.startsWith("http") ? url : `https://${url}`
    setLiveUrl(full)
    setShowExternal(true)
    setLoadError(false)
    if (iframeRef.current) {
      iframeRef.current.removeAttribute("srcdoc")
      iframeRef.current.src = full
    }
  }

  function handleOpenExternal() {
    if (showExternal && liveUrl) {
      window.open(liveUrl, "_blank")
      return
    }
    const html = buildPreview(fileTree, activeFile?.path)
    const url = URL.createObjectURL(new Blob([html], { type: "text/html" }))
    window.open(url, "_blank")
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  }

  function handleLocalPreview() {
    setShowExternal(false)
    setLiveUrl("")
    setLoadError(false)
    setTimeout(buildAndSet, 0)
  }

  return (
    <div className="preview-panel">
      <div className="preview-toolbar">
        <div className="preview-presets" role="group" aria-label="Preview viewport">
          {(["mobile", "tablet", "desktop"] as PreviewViewport[]).map((v) => {
            const preset = viewportConfig[v]
            return (
              <button
                type="button"
                key={v}
                className={`preview-viewport-btn ${viewport === v ? "active" : ""}`}
                onClick={() => updatePreviewSettings({ viewport: v })}
                title={`${preset.label} ${preset.detail}`}
              >
                <span className={`preview-preset-mark ${v}`} aria-hidden="true" />
                <span>{preset.label}</span>
                <small>{preset.detail}</small>
              </button>
            )
          })}
        </div>
        <div className="preview-url-bar">
          <BrowserIcon />
          <input value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} placeholder="Preview a URL" onKeyDown={(e) => e.key === "Enter" && handleGoUrl()} />
        </div>
        <button type="button" className="btn btn-secondary preview-go-btn" onClick={handleGoUrl}>Go</button>
        {showExternal && (
          <button type="button" className="btn btn-ghost preview-local-btn" onClick={handleLocalPreview}>Local</button>
        )}
        <div className="preview-toolbar-actions">
          {viewport !== "desktop" && <span className="preview-scale-readout">{Math.round(previewScale * 100)}% scale</span>}
          <button type="button" className="btn-icon" onClick={handleRefresh} title="Refresh preview" aria-label="Refresh preview"><RefreshIcon /></button>
          <button type="button" className="btn-icon" onClick={handleOpenExternal} title="Open in new tab" aria-label="Open in new tab"><ExternalIcon /></button>
        </div>
      </div>

      <div className={`preview-content-area ${viewport === "desktop" ? "is-responsive" : "is-fixed"}`} ref={stageRef}>
        {viewport === "desktop" ? (
          <div className="preview-responsive-frame">
            <iframe ref={iframeRef} title="Preview" sandbox="allow-scripts allow-same-origin allow-modals allow-forms allow-popups" allow="camera; microphone" onError={() => setLoadError(true)} />
          </div>
        ) : (
          <div className="preview-fixed-stage">
            <div className="preview-viewport-shell" style={{ width: cfg.width * previewScale, height: cfg.height * previewScale }}>
              <div
                className={`preview-viewport-frame ${viewport}`}
                style={{ width: cfg.width, height: cfg.height, transform: `scale(${previewScale})` }}
              >
                <iframe ref={iframeRef} title="Preview" sandbox="allow-scripts allow-same-origin allow-modals allow-forms allow-popups" allow="camera; microphone" onError={() => setLoadError(true)} />
              </div>
            </div>
            <div className="preview-viewport-caption">
              <strong>{cfg.label}</strong>
              <span>{cfg.detail}px viewport</span>
            </div>
          </div>
        )}

        {loadError && (
          <div className="preview-error-banner">
            <span className="preview-error-mark">!</span>
            <span>This URL blocks embedding.</span>
            <button type="button" onClick={handleOpenExternal}>Open in browser tab</button>
          </div>
        )}
      </div>
    </div>
  )
}
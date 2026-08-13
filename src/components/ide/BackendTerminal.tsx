import { useEffect, useMemo, useRef, useState } from "react"
import { useIDEStore } from "@/store/ideStore"

type Line = { id: string; text: string; type: "input" | "output" | "error" | "info" | "success" }
type Message = { type?: string; text?: string; message?: string; code?: number; ok?: boolean; timedOut?: boolean; overflow?: boolean }

function websocketUrl(baseUrl: string) {
  if (!baseUrl) return ""
  return `${baseUrl.replace(/\/$/, "").replace(/^http/, "ws")}/api/ws/terminal`
}

export default function BackendTerminal() {
  const { settings } = useIDEStore()
  const [lines, setLines] = useState<Line[]>([])
  const [input, setInput] = useState("")
  const [connected, setConnected] = useState(false)
  const socketRef = useRef<WebSocket | null>(null)
  const resolvedBaseUrl = settings.backend.url || import.meta.env.VITE_API_URL || ""
  const configuredWebSocketUrl = import.meta.env.VITE_WS_URL || ""
  const url = useMemo(() => configuredWebSocketUrl || websocketUrl(resolvedBaseUrl), [configuredWebSocketUrl, resolvedBaseUrl])

  const addLine = (text: string, type: Line["type"]) => setLines((current) => [...current.slice(-499), { id: `${Date.now()}-${Math.random()}`, text, type }])

  useEffect(() => {
    if (!settings.backend.enabled || !url) {
      setConnected(false)
      addLine("Configure a backend URL in Storage settings to use the isolated Oracle terminal.", "info")
      return
    }
    const socket = new WebSocket(url)
    socketRef.current = socket
    socket.onopen = () => setConnected(true)
    socket.onmessage = (event) => {
      let message: Message
      try {
        message = JSON.parse(event.data) as Message
      } catch {
        addLine("Received an invalid response from the terminal service.", "error")
        return
      }
      if (message.type === "stdout") addLine(message.text || "", "output")
      else if (message.type === "stderr" || message.type === "error") addLine(message.text || message.message || "Terminal error.", "error")
      else if (message.type === "exit") addLine(message.message || `exit ${message.code ?? 1}${message.timedOut ? " (timed out)" : ""}${message.overflow ? " (output capped)" : ""}`, message.ok ? "success" : "error")
      else addLine(message.message || "Terminal ready.", "info")
    }
    socket.onclose = () => setConnected(false)
    socket.onerror = () => addLine("The isolated terminal connection failed.", "error")
    return () => {
      socket.close()
      socketRef.current = null
    }
  }, [settings.backend.enabled, url])

  const submit = () => {
    const command = input.trim()
    if (!command || !connected || socketRef.current?.readyState !== WebSocket.OPEN) return
    addLine(`$ ${command}`, "input")
    socketRef.current.send(JSON.stringify({ type: "exec", command }))
    setInput("")
  }

  return (
    <div className="flex h-full flex-col bg-terminal-bg">
      <div className="border-b border-border px-3 py-2 text-[11px] text-muted-foreground">{connected ? "Connected to the isolated Oracle terminal" : "Oracle terminal is disconnected"}</div>
      <div className="flex-1 overflow-y-auto p-3 font-mono text-xs leading-5">
        {lines.map((line) => <div key={line.id} className={line.type === "error" ? "whitespace-pre-wrap text-destructive" : line.type === "success" || line.type === "input" ? "whitespace-pre-wrap text-success" : line.type === "info" ? "whitespace-pre-wrap text-info" : "whitespace-pre-wrap text-foreground"}>{line.text}</div>)}
      </div>
      <div className="flex items-center gap-2 border-t border-border px-3 py-2">
        <span className="font-mono text-xs font-bold text-success">$</span>
        <input value={input} disabled={!connected} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") submit() }} placeholder={connected ? "Run an isolated command..." : "Connect a backend to enable commands"} className="flex-1 bg-transparent font-mono text-xs text-foreground outline-none placeholder:text-muted-foreground/40 disabled:opacity-50" />
      </div>
    </div>
  )
}

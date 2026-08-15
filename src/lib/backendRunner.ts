function backendBase(endpoint?: string) {
  const value = endpoint?.trim().replace(/\/$/, "")
  if (!value) return "/api"
  try {
    const parsed = new URL(value)
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return "/api"
    return parsed.pathname.endsWith("/api") ? value : `${value}/api`
  } catch {
    return "/api"
  }
}

function websocketUrl(endpoint?: string) {
  const base = backendBase(endpoint)
  if (base.startsWith("/")) {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
    return `${protocol}//${window.location.host}${base}/ws/terminal`
  }
  const target = new URL(base)
  target.protocol = target.protocol === "https:" ? "wss:" : "ws:"
  target.pathname = `${target.pathname.replace(/\/$/, "")}/ws/terminal`
  return target.toString()
}

export interface ExecResult {
  stdout: string
  stderr: string
  exitCode: number
  executionTime: number
  error?: string
}

let _available: boolean | null = null
let _availabilityEndpoint = ""

export async function isBackendAvailable(endpoint?: string, enabled = true): Promise<boolean> {
  if (!enabled) return false
  const base = backendBase(endpoint)
  if (_availabilityEndpoint !== base) {
    _availabilityEndpoint = base
    _available = null
  }
  if (_available !== null) return _available
  try {
    const r = await fetch(`${base}/healthz`, { signal: AbortSignal.timeout(3000) })
    if (!r.ok) {
      _available = false
      return false
    }
    const body = await r.json() as { status?: string }
    _available = body.status === "ok"
  } catch {
    _available = false
  }
  return _available
}

export function resetAvailability() {
  _available = null
  _availabilityEndpoint = ""
}

export async function runOnBackend(
  language: string,
  code: string,
  opts?: { cwd?: string; endpoint?: string }
): Promise<ExecResult> {
  try {
    const res = await fetch(`${backendBase(opts?.endpoint)}/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language, code, ...opts }),
      signal: AbortSignal.timeout(35000),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => res.statusText)
      return { stdout: "", stderr: body, exitCode: 1, executionTime: 0, error: body }
    }
    return await res.json() as ExecResult
  } catch (e) {
    return { stdout: "", stderr: String(e), exitCode: 1, executionTime: 0, error: String(e) }
  }
}

export interface RuntimeInfo {
  name: string
  available: boolean
}

export async function getAvailableRuntimes(): Promise<RuntimeInfo[]> {
  try {
    const res = await fetch(`${backendBase()}/execute/runtimes`, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return []
    const data = await res.json() as { runtimes: RuntimeInfo[] }
    return data.runtimes ?? []
  } catch {
    return []
  }
}

export async function syncBackendWorkspace(sessionId: string, files: { path: string; content: string }[], endpoint?: string) {
  const res = await fetch(`${backendBase(endpoint)}/execute/sessions/${encodeURIComponent(sessionId)}/files`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ files }),
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) throw new Error(await res.text().catch(() => "Workspace synchronization failed."))
}

export function createTerminalWebSocket(
  onReady: (cwd: string, sessionId: string) => void,
  onStdout: (data: string) => void,
  onStderr: (data: string) => void,
  onExit: (code: number, cwd: string) => void,
  onError: (err: string) => void,
  endpoint?: string
): { send: (msg: Record<string, unknown>) => void; close: () => void } {
  const ws = new WebSocket(websocketUrl(endpoint))

  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data as string) as {
        type: string; data?: string; code?: number; cwd?: string
      }
      if (msg.type === "ready") onReady(msg.cwd ?? "", (msg as { sessionId?: string }).sessionId ?? "")
      else if (msg.type === "stdout") onStdout(msg.data ?? "")
      else if (msg.type === "stderr") onStderr(msg.data ?? "")
      else if (msg.type === "exit") onExit(msg.code ?? 0, msg.cwd ?? "")
    } catch {}
  }

  ws.onerror = () => onError("WebSocket connection failed")

  return {
    send: (msg) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg))
    },
    close: () => ws.close(),
  }
}

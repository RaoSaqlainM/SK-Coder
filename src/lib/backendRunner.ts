const BASE = "/api"

export interface ExecResult {
  stdout: string
  stderr: string
  exitCode: number
  executionTime: number
  error?: string
}

let _available: boolean | null = null

export async function isBackendAvailable(): Promise<boolean> {
  if (_available !== null) return _available
  try {
    const r = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(3000) })
    _available = r.ok
  } catch {
    _available = false
  }
  return _available
}

export function resetAvailability() {
  _available = null
}

export async function runOnBackend(
  language: string,
  code: string,
  opts?: { cwd?: string }
): Promise<ExecResult> {
  try {
    const res = await fetch(`${BASE}/execute`, {
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
    const res = await fetch(`${BASE}/execute/runtimes`, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return []
    const data = await res.json() as { runtimes: RuntimeInfo[] }
    return data.runtimes ?? []
  } catch {
    return []
  }
}

export function createTerminalWebSocket(
  onReady: (cwd: string) => void,
  onStdout: (data: string) => void,
  onStderr: (data: string) => void,
  onExit: (code: number, cwd: string) => void,
  onError: (err: string) => void
): { send: (msg: Record<string, unknown>) => void; close: () => void } {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:"
  const ws = new WebSocket(`${proto}//${window.location.host}/api/ws/terminal`)

  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data as string) as {
        type: string; data?: string; code?: number; cwd?: string
      }
      if (msg.type === "ready") onReady(msg.cwd ?? "")
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

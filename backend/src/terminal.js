import { WebSocketServer } from "ws"
import { executeTerminalCommand } from "./execution.js"
import { config } from "./config.js"

export function attachTerminal(server) {
  const sockets = new WebSocketServer({ noServer: true, maxPayload: 8192 })
  server.on("upgrade", (request, socket, head) => {
    if (new URL(request.url, "http://localhost").pathname !== "/api/ws/terminal") return
    const origin = request.headers.origin
    if (origin && !config.corsOrigins.includes(origin)) {
      socket.write("HTTP/1.1 403 Forbidden\r\n\r\n")
      socket.destroy()
      return
    }
    sockets.handleUpgrade(request, socket, head, (client) => sockets.emit("connection", client, request))
  })
  sockets.on("connection", (client) => {
    client.send(JSON.stringify({ type: "ready", message: "SK Coder isolated terminal ready." }))
    client.on("message", async (raw) => {
      let payload
      try {
        payload = JSON.parse(raw.toString())
      } catch {
        client.send(JSON.stringify({ type: "error", message: "Messages must be valid JSON." }))
        return
      }
      if (payload.type !== "exec") {
        client.send(JSON.stringify({ type: "error", message: "Only exec messages are supported." }))
        return
      }
      client.send(JSON.stringify({ type: "status", message: "Executing in an isolated container." }))
      const result = await executeTerminalCommand(payload.command)
      if (result.stdout) client.send(JSON.stringify({ type: "stdout", text: result.stdout }))
      if (result.stderr) client.send(JSON.stringify({ type: "stderr", text: result.stderr }))
      client.send(JSON.stringify({ type: "exit", code: result.code ?? 1, ok: result.ok, timedOut: result.timedOut ?? false, overflow: result.overflow ?? false, message: result.message }))
    })
  })
}

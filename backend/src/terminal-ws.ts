import { WebSocketServer, WebSocket } from "ws"
import { Server } from "http"
import { spawn, ChildProcess } from "child_process"
import { stat } from "fs/promises"
import { resolve } from "path"
import { tmpdir } from "os"

interface Session {
  cwd: string
  proc: ChildProcess | null
}

export function setupTerminalWs(server: Server): void {
  const wss = new WebSocketServer({ noServer: true })

  server.on("upgrade", (req, socket, head) => {
    if (req.url === "/api/ws/terminal") {
      wss.handleUpgrade(req, socket as import("net").Socket, head, (ws) => {
        wss.emit("connection", ws, req)
      })
    } else {
      socket.destroy()
    }
  })

  wss.on("connection", (ws: WebSocket) => {
    const session: Session = {
      cwd: process.env["HOME"] || tmpdir(),
      proc: null,
    }

    function send(obj: Record<string, unknown>) {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj))
    }

    send({ type: "ready", cwd: session.cwd })

    async function handleCd(target: string) {
      const raw = target.trim().replace(/^["']|["']$/g, "")
      const newPath = raw === "" || raw === "~"
        ? (process.env["HOME"] || tmpdir())
        : resolve(session.cwd, raw)
      try {
        const s = await stat(newPath)
        if (s.isDirectory()) {
          session.cwd = newPath
          send({ type: "exit", code: 0, cwd: session.cwd })
        } else {
          send({ type: "stderr", data: `bash: cd: ${raw}: Not a directory\n` })
          send({ type: "exit", code: 1, cwd: session.cwd })
        }
      } catch {
        send({ type: "stderr", data: `bash: cd: ${raw}: No such file or directory\n` })
        send({ type: "exit", code: 1, cwd: session.cwd })
      }
    }

    function killProc() {
      if (session.proc) {
        try { session.proc.kill("SIGTERM") } catch {}
        setTimeout(() => {
          try { session.proc?.kill("SIGKILL") } catch {}
        }, 1000)
        session.proc = null
      }
    }

    ws.on("message", async (data) => {
      let msg: { type: string; command?: string; cwd?: string }
      try { msg = JSON.parse(data.toString()) } catch { return }

      if (msg.type === "kill") {
        killProc()
        send({ type: "exit", code: -1, cwd: session.cwd })
        return
      }

      if (msg.type === "cd" && msg.cwd) {
        await handleCd(msg.cwd)
        return
      }

      if (msg.type === "command" && msg.command) {
        const cmd = msg.command.trim()
        if (!cmd) return

        if (cmd === "cd" || cmd.match(/^cd\s+/) || cmd.match(/^cd$/)) {
          await handleCd(cmd.replace(/^cd\s*/, ""))
          return
        }

        killProc()

        const proc = spawn("bash", ["-c", cmd], {
          cwd: session.cwd,
          env: {
            ...process.env,
            TERM: "xterm-color",
            COLORTERM: "truecolor",
            HOME: process.env["HOME"] || tmpdir(),
            PWD: session.cwd,
          },
        })

        session.proc = proc

        proc.stdout.on("data", (d: Buffer) => send({ type: "stdout", data: d.toString() }))
        proc.stderr.on("data", (d: Buffer) => send({ type: "stderr", data: d.toString() }))

        proc.on("close", (code) => {
          session.proc = null
          send({ type: "exit", code: code ?? 0, cwd: session.cwd })
        })

        proc.on("error", (e) => {
          session.proc = null
          send({ type: "stderr", data: `Error: ${e.message}\n` })
          send({ type: "exit", code: 127, cwd: session.cwd })
        })
      }
    })

    ws.on("close", () => {
      killProc()
    })
  })
}

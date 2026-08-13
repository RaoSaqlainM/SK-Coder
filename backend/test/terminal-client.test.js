import test from "node:test"
import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import net from "node:net"
import { WebSocket } from "ws"

function availablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.once("error", reject)
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      server.close((error) => error ? reject(error) : resolve(address.port))
    })
  })
}

async function startBackend() {
  const port = await availablePort()
  const storageRoot = await mkdtemp(path.join(tmpdir(), "sk-coder-terminal-test-"))
  const child = spawn(process.execPath, ["src/server.js"], {
    cwd: path.resolve(import.meta.dirname, ".."),
    env: { ...process.env, HOST: "127.0.0.1", SK_CODER_PORT: String(port), STORAGE_ROOT: storageRoot },
    stdio: ["ignore", "pipe", "pipe"]
  })
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Timed out starting the backend.")), 10000)
    child.once("error", reject)
    child.stdout.on("data", (chunk) => {
      if (chunk.toString().includes("SK Coder backend listening")) {
        clearTimeout(timeout)
        resolve()
      }
    })
  })
  return { child, port, storageRoot }
}

function stopBackend(child) {
  return new Promise((resolve) => {
    child.once("exit", resolve)
    child.kill("SIGTERM")
  })
}

test("the isolated terminal accepts an allowed WebSocket origin and returns a controlled unavailable response", async () => {
  const backend = await startBackend()
  try {
    await new Promise((resolve, reject) => {
      const socket = new WebSocket(`ws://127.0.0.1:${backend.port}/api/ws/terminal`, { origin: "http://localhost:5174" })
      const timeout = setTimeout(() => {
        socket.close()
        reject(new Error("Timed out waiting for the terminal response."))
      }, 10000)
      socket.on("error", reject)
      socket.on("message", (raw) => {
        const message = JSON.parse(raw.toString())
        if (message.type === "ready") {
          socket.send(JSON.stringify({ type: "exec", command: "echo 42" }))
          return
        }
        if (message.type === "exit") {
          clearTimeout(timeout)
          assert.equal(message.ok, false)
          assert.equal(message.message, "The isolated terminal service is unavailable.")
          socket.close()
          resolve()
        }
      })
    })
  } finally {
    await stopBackend(backend.child)
    await rm(backend.storageRoot, { recursive: true, force: true })
  }
})

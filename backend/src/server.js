import http from "node:http"
import express from "express"
import { config } from "./config.js"
import { executeSource } from "./execution.js"
import { cleanupExpiredStorage, ensureStorage, saveUpload, storageStatus } from "./storage.js"
import { publicRuntimes } from "./runtimes.js"
import { attachTerminal } from "./terminal.js"

const app = express()
const visits = new Map()

function clientKey(request) {
  return request.headers["x-forwarded-for"]?.toString().split(",")[0].trim() || request.socket.remoteAddress || "unknown"
}

function allowRequest(request, response, next) {
  const key = clientKey(request)
  const now = Date.now()
  const entry = visits.get(key) || { startedAt: now, count: 0 }
  const current = now - entry.startedAt >= 60000 ? { startedAt: now, count: 0 } : entry
  current.count += 1
  visits.set(key, current)
  if (current.count > config.maxRequestsPerMinute) {
    response.status(429).json({ ok: false, message: "Rate limit reached. Please wait before trying again." })
    return
  }
  next()
}

function cors(request, response, next) {
  const origin = request.headers.origin
  if (origin && config.corsOrigins.includes(origin)) {
    response.setHeader("Access-Control-Allow-Origin", origin)
    response.setHeader("Vary", "Origin")
    response.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Admin-Token")
    response.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
  }
  if (request.method === "OPTIONS") {
    response.status(204).end()
    return
  }
  next()
}

function requireAdmin(request, response, next) {
  if (!config.adminToken || request.headers["x-admin-token"] !== config.adminToken) {
    response.status(403).json({ ok: false, message: "An administrator token is required." })
    return
  }
  next()
}

app.disable("x-powered-by")
app.use(cors)
app.use(allowRequest)
app.get("/api/health", async (_request, response) => response.json({ ok: true, service: "sk-coder-backend", storage: await storageStatus() }))
app.get("/api/exec/runtimes", (_request, response) => response.json({ ok: true, runtimes: publicRuntimes() }))
app.post("/api/exec", express.json({ limit: `${Math.ceil(config.maxCodeBytes / 1024)}kb` }), async (request, response) => {
  const result = await executeSource(request.body || {})
  response.status(result.status).json(result)
})
app.post("/api/storage/upload", express.raw({ type: "application/octet-stream", limit: config.maxUploadBytes }), async (request, response) => {
  const result = await saveUpload(request.body, request.query.name)
  response.status(result.stored ? 201 : result.reason === "USE_INDEXEDDB" ? 409 : 413).json(result)
})
app.get("/api/storage/status", async (_request, response) => response.json({ ok: true, ...(await storageStatus()) }))
app.delete("/api/storage/cleanup", requireAdmin, async (_request, response) => response.json({ ok: true, ...(await cleanupExpiredStorage()) }))
app.use((_request, response) => response.status(404).json({ ok: false, message: "Endpoint not found." }))

const server = http.createServer(app)
attachTerminal(server)
await ensureStorage()
await cleanupExpiredStorage()
setInterval(() => {
  void cleanupExpiredStorage()
}, 60 * 60 * 1000).unref()
server.listen(config.port, config.host, () => console.log(`SK Coder backend listening on ${config.host}:${config.port}`))

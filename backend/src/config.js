import path from "node:path"

function integer(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function origins(value) {
  return (value ?? "http://localhost:5173,http://localhost:5174").split(",").map((origin) => origin.trim()).filter(Boolean)
}

export const config = Object.freeze({
  host: process.env.HOST || "0.0.0.0",
  port: integer(process.env.SK_CODER_PORT ?? process.env.PORT, 8787),
  corsOrigins: origins(process.env.CORS_ORIGINS),
  storageRoot: path.resolve(process.env.STORAGE_ROOT || "./storage"),
  storageCapacityBytes: integer(process.env.STORAGE_CAPACITY_GB, 140) * 1024 ** 3,
  storageOffloadBytes: integer(process.env.STORAGE_OFFLOAD_GB, 100) * 1024 ** 3,
  storageTtlMs: integer(process.env.STORAGE_TTL_HOURS, 72) * 60 * 60 * 1000,
  maxUploadBytes: integer(process.env.MAX_UPLOAD_MB, 100) * 1024 ** 2,
  maxCodeBytes: integer(process.env.MAX_CODE_KB, 512) * 1024,
  executionTimeoutMs: integer(process.env.EXECUTION_TIMEOUT_SECONDS, 15) * 1000,
  terminalTimeoutMs: integer(process.env.TERMINAL_TIMEOUT_SECONDS, 12) * 1000,
  maxRequestsPerMinute: integer(process.env.MAX_REQUESTS_PER_MINUTE, 30),
  adminToken: process.env.ADMIN_TOKEN || ""
})

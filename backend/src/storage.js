import { mkdir, readdir, rm, stat, writeFile } from "node:fs/promises"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { config } from "./config.js"

const uploadsPath = path.join(config.storageRoot, "uploads")

async function sizeOf(target) {
  const entry = await stat(target)
  if (entry.isFile()) return entry.size
  const children = await readdir(target)
  const sizes = await Promise.all(children.map((name) => sizeOf(path.join(target, name))))
  return sizes.reduce((total, value) => total + value, 0)
}

function safeName(name) {
  return path.basename(String(name || "upload.bin")).replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120) || "upload.bin"
}

export async function ensureStorage() {
  await mkdir(uploadsPath, { recursive: true, mode: 0o700 })
}

export async function storageStatus() {
  await ensureStorage()
  const usedBytes = await sizeOf(config.storageRoot)
  return {
    usedBytes,
    capacityBytes: config.storageCapacityBytes,
    offloadThresholdBytes: config.storageOffloadBytes,
    useIndexedDb: usedBytes >= config.storageOffloadBytes
  }
}

export async function saveUpload(buffer, originalName) {
  const status = await storageStatus()
  if (status.useIndexedDb || status.usedBytes + buffer.length > config.storageOffloadBytes) return { stored: false, reason: "USE_INDEXEDDB", status }
  if (buffer.length > config.maxUploadBytes) return { stored: false, reason: "UPLOAD_TOO_LARGE", status }
  const id = randomUUID()
  const fileName = `${id}-${safeName(originalName)}`
  const target = path.join(uploadsPath, fileName)
  await writeFile(target, buffer, { mode: 0o600 })
  return { stored: true, id, fileName, bytes: buffer.length, expiresAt: new Date(Date.now() + config.storageTtlMs).toISOString(), status: await storageStatus() }
}

export async function cleanupExpiredStorage(now = Date.now()) {
  await ensureStorage()
  const entries = await readdir(uploadsPath, { withFileTypes: true })
  let removed = 0
  for (const entry of entries) {
    const target = path.join(uploadsPath, entry.name)
    const details = await stat(target)
    if (now - details.mtimeMs >= config.storageTtlMs) {
      await rm(target, { force: true, recursive: true })
      removed += 1
    }
  }
  return { removed, status: await storageStatus() }
}

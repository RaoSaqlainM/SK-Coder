import type { FileNode } from "@/types/ide"

type StorageStatus = { useIndexedDb: boolean }
type StorageResult = { target: "server" | "indexeddb"; message: string }

const databaseName = "sk-coder-workspace"
const storeName = "snapshots"

function backupDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(storeName)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function saveIndexedDbSnapshot(tree: FileNode[]) {
  const database = await backupDatabase()
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(storeName, "readwrite")
    transaction.objectStore(storeName).put({ tree, savedAt: Date.now() }, "active-workspace")
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error)
  })
  database.close()
}

function apiBase(url: string) {
  return url.replace(/\/$/, "")
}

export async function storeImportedWorkspace(tree: FileNode[], backendUrl: string, enabled: boolean): Promise<StorageResult> {
  const configuredUrl = backendUrl || import.meta.env.VITE_API_URL || ""
  if (!enabled || !configuredUrl) {
    await saveIndexedDbSnapshot(tree)
    return { target: "indexeddb", message: "Saved to IndexedDB because no storage backend is configured." }
  }
  try {
    const base = apiBase(configuredUrl)
    const statusResponse = await fetch(`${base}/api/storage/status`)
    const status = await statusResponse.json() as StorageStatus
    if (statusResponse.ok && !status.useIndexedDb) {
      const snapshot = new Blob([JSON.stringify({ tree, savedAt: Date.now() })], { type: "application/octet-stream" })
      const upload = await fetch(`${base}/api/storage/upload?name=workspace.json`, { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: snapshot })
      if (upload.status === 201) return { target: "server", message: "Stored temporary workspace data on the server for up to 72 hours." }
      if (upload.status !== 409) throw new Error("The storage backend could not save this workspace.")
    }
  } catch {
    await saveIndexedDbSnapshot(tree)
    return { target: "indexeddb", message: "Saved to IndexedDB because the storage backend is unavailable." }
  }
  await saveIndexedDbSnapshot(tree)
  return { target: "indexeddb", message: "Saved to IndexedDB because the server has reached its offload threshold." }
}

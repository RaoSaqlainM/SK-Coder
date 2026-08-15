import type { FileNode } from "@/types/ide"

type StorageStatus = { useIndexedDb: boolean }
type StorageResult = { target: "server" | "indexeddb"; message: string }
type WorkspaceSnapshot = { tree: FileNode[]; savedAt: number; version: 1 }

const databaseName = "sk-coder-workspace"
const storeName = "snapshots"
const workspaceKey = "active-workspace"

function backupDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(storeName)) request.result.createObjectStore(storeName)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function saveWorkspaceSnapshot(tree: FileNode[]) {
  if (typeof indexedDB === "undefined") return
  const database = await backupDatabase()
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(storeName, "readwrite")
    transaction.objectStore(storeName).put({ tree, savedAt: Date.now(), version: 1 } satisfies WorkspaceSnapshot, workspaceKey)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error)
  })
  database.close()
}

export async function loadWorkspaceSnapshot() {
  if (typeof indexedDB === "undefined") return null
  const database = await backupDatabase()
  const snapshot = await new Promise<WorkspaceSnapshot | null>((resolve, reject) => {
    const transaction = database.transaction(storeName, "readonly")
    const request = transaction.objectStore(storeName).get(workspaceKey)
    request.onsuccess = () => resolve((request.result as WorkspaceSnapshot | undefined) ?? null)
    request.onerror = () => reject(request.error)
  })
  database.close()
  return snapshot
}

function apiBase(url: string) {
  return url.replace(/\/$/, "")
}

export async function storeImportedWorkspace(tree: FileNode[], backendUrl: string, enabled: boolean): Promise<StorageResult> {
  await saveWorkspaceSnapshot(tree)
  const configuredUrl = backendUrl || import.meta.env.VITE_API_URL || ""
  if (!enabled || !configuredUrl) return { target: "indexeddb", message: "Workspace saved locally in IndexedDB." }
  try {
    const base = apiBase(configuredUrl)
    const statusResponse = await fetch(`${base}/api/storage/status`)
    const status = await statusResponse.json() as StorageStatus
    if (statusResponse.ok && !status.useIndexedDb) {
      const snapshot = new Blob([JSON.stringify({ tree, savedAt: Date.now(), version: 1 })], { type: "application/json" })
      const upload = await fetch(`${base}/api/storage/upload?name=workspace.json`, { method: "POST", headers: { "Content-Type": "application/json" }, body: snapshot })
      if (upload.status === 201) return { target: "server", message: "Workspace snapshot stored on the temporary backend for up to 72 hours." }
      if (upload.status !== 409) throw new Error("The storage backend could not save this workspace.")
    }
  } catch {
    return { target: "indexeddb", message: "Workspace saved locally because the storage backend is unavailable." }
  }
  return { target: "indexeddb", message: "Workspace saved locally because the server reached its offload threshold." }
}

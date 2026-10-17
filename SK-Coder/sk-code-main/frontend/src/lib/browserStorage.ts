export type BrowserStorageStatus = {
  available: boolean;
  usage: number;
  quota: number;
  remaining: number;
  persistent: boolean;
  nearLimit: boolean;
};

const BLOB_DB_NAME = "sk-coder-project-blobs-v1";
const BLOB_STORE_NAME = "blobs";
const OPFS_DIRECTORY_NAME = "sk-coder-project-files-v1";

type BrowserBlobBackend = "opfs" | "idb";

export function browserBlobStorageTarget(key: string): { backend: BrowserBlobBackend; id: string } {
  if (key.startsWith("opfs:")) return { backend: "opfs", id: key.slice(5) };
  if (key.startsWith("idb:")) return { backend: "idb", id: key.slice(4) };
  return { backend: "idb", id: key };
}

async function openOpfsDirectory(): Promise<FileSystemDirectoryHandle | null> {
  if (typeof navigator === "undefined") return null;
  const storage = navigator.storage as StorageManager & { getDirectory?: () => Promise<FileSystemDirectoryHandle> };
  if (typeof storage.getDirectory !== "function") return null;
  try {
    const root = await storage.getDirectory();
    return root.getDirectoryHandle(OPFS_DIRECTORY_NAME, { create: true });
  } catch {
    return null;
  }
}

async function storeOpfsBlob(id: string, file: Blob): Promise<boolean> {
  const directory = await openOpfsDirectory();
  if (!directory) return false;
  const handle = await directory.getFileHandle(id, { create: true });
  const writable = await handle.createWritable();
  try {
    await writable.write(file);
    await writable.close();
    return true;
  } catch (error) {
    await writable.abort().catch(() => undefined);
    throw error;
  }
}

async function loadOpfsBlob(id: string): Promise<Blob | null> {
  const directory = await openOpfsDirectory();
  if (!directory) return null;
  try {
    return await (await directory.getFileHandle(id)).getFile();
  } catch {
    return null;
  }
}

async function deleteOpfsBlob(id: string): Promise<void> {
  const directory = await openOpfsDirectory();
  if (!directory) return;
  await directory.removeEntry(id).catch(() => undefined);
}

function openBlobDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    const request = indexedDB.open(BLOB_DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(BLOB_STORE_NAME)) request.result.createObjectStore(BLOB_STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

export async function storeBrowserBlob(file: Blob): Promise<string> {
  const id = `${Date.now().toString(36)}-${crypto.randomUUID()}`;
  if (await storeOpfsBlob(id, file)) return `opfs:${id}`;
  const database = await openBlobDatabase();
  if (!database) throw new Error("This browser cannot open local project blob storage.");
  await new Promise<void>((resolve, reject) => {
    const request = database.transaction(BLOB_STORE_NAME, "readwrite").objectStore(BLOB_STORE_NAME).put(file, id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("Browser blob storage failed."));
  });
  return `idb:${id}`;
}

export async function loadBrowserBlob(id: string): Promise<Blob | null> {
  const target = browserBlobStorageTarget(id);
  if (target.backend === "opfs") return loadOpfsBlob(target.id);
  const database = await openBlobDatabase();
  if (!database) return null;
  return new Promise((resolve) => {
    const request = database.transaction(BLOB_STORE_NAME, "readonly").objectStore(BLOB_STORE_NAME).get(target.id);
    request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : null);
    request.onerror = () => resolve(null);
  });
}

export async function deleteBrowserBlob(id: string): Promise<void> {
  const target = browserBlobStorageTarget(id);
  if (target.backend === "opfs") {
    await deleteOpfsBlob(target.id);
    return;
  }
  const database = await openBlobDatabase();
  if (!database) return;
  await new Promise<void>((resolve) => {
    const request = database.transaction(BLOB_STORE_NAME, "readwrite").objectStore(BLOB_STORE_NAME).delete(target.id);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
  });
}

export async function getBrowserStorageStatus(): Promise<BrowserStorageStatus> {
  if (typeof navigator === "undefined" || !navigator.storage) {
    return { available: false, usage: 0, quota: 0, remaining: 0, persistent: false, nearLimit: false };
  }
  const [estimate, persistent] = await Promise.all([
    navigator.storage.estimate().catch(() => ({ usage: 0, quota: 0 })),
    navigator.storage.persisted?.().catch(() => false) ?? Promise.resolve(false),
  ]);
  const usage = estimate.usage ?? 0;
  const quota = estimate.quota ?? 0;
  const remaining = Math.max(0, quota - usage);
  return { available: quota > 0, usage, quota, remaining, persistent, nearLimit: quota > 0 && (usage / quota >= 0.75 || remaining <= 64 * 1024 * 1024) };
}

export async function prepareBrowserProjectImport(bytes: number): Promise<BrowserStorageStatus> {
  const status = await getBrowserStorageStatus();
  if (status.available && bytes > status.remaining) {
    throw new Error(`This device has about ${formatBytes(status.remaining)} available for browser project storage, but the selected import needs ${formatBytes(bytes)}.`);
  }
  if (!status.persistent && typeof navigator !== "undefined" && navigator.storage?.persist) {
    await navigator.storage.persist().catch(() => false);
  }
  return getBrowserStorageStatus();
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

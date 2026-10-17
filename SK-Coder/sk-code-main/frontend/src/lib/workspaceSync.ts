import { storeBrowserBlob, loadBrowserBlob, deleteBrowserBlob } from "./browserStorage";

export type SyncStatus = "synced" | "pending" | "error" | "offline";

export type SyncedFile = {
    path: string;
    content: string;
    size: number;
    lastModified: number;
    syncedAt: number;
    hash?: string;
};

const SYNC_DB_NAME = "sk-coder-workspace-sync-v1";
const SYNC_STORE_NAME = "sync";
const SYNC_INTERVAL_MS = 30000;

let syncInterval: NodeJS.Timeout | null = null;
let db: IDBDatabase | null = null;
const dirtyFiles = new Set<string>();
const syncedFiles = new Map<string, SyncedFile>();

async function openSyncDB(): Promise<IDBDatabase> {
    if (db) return db;
    
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(SYNC_DB_NAME, 1);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve(db!);
        };
        
        request.onupgradeneeded = (event) => {
            const database = (event.target as IDBOpenDBRequest).result;
            if (!database.objectStoreNames.contains(SYNC_STORE_NAME)) {
                const store = database.createObjectStore(SYNC_STORE_NAME, { keyPath: "path" });
                store.createIndex("lastModified", "lastModified", { unique: false });
                store.createIndex("syncedAt", "syncedAt", { unique: false });
            }
        };
    });
}

export async function initSync(): Promise<void> {
    await openSyncDB();
    await loadAllSyncedFiles();
}

export async function saveFile(path: string, content: string): Promise<void> {
    const file: SyncedFile = {
        path,
        content,
        size: content.length,
        lastModified: Date.now(),
        syncedAt: 0,
        hash: await hashContent(content)
    };
    
    const blobId = await storeBrowserBlob(new Blob([content]));
    
    const database = await openSyncDB();
    const tx = database.transaction(SYNC_STORE_NAME, "readwrite");
    const store = tx.objectStore(SYNC_STORE_NAME);
    
    await new Promise<void>((resolve, reject) => {
        const request = store.put(file);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
    
    syncedFiles.set(path, file);
    dirtyFiles.add(path);
}

export async function loadFile(path: string): Promise<string | null> {
    const blob = await loadBrowserBlob(`idb:sync:${path}`);
    if (blob) {
        return await blob.text();
    }
    
    const database = await openSyncDB();
    const tx = database.transaction(SYNC_STORE_NAME, "readonly");
    const store = tx.objectStore(SYNC_STORE_NAME);
    
    return new Promise((resolve, reject) => {
        const request = store.get(path);
        request.onsuccess = () => resolve(request.result?.content || null);
        request.onerror = () => reject(request.error);
    });
}

export async function deleteFile(path: string): Promise<void> {
    await deleteBrowserBlob(`idb:sync:${path}`);
    
    const database = await openSyncDB();
    const tx = database.transaction(SYNC_STORE_NAME, "readwrite");
    const store = tx.objectStore(SYNC_STORE_NAME);
    
    await new Promise<void>((resolve, reject) => {
        const request = store.delete(path);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
    
    syncedFiles.delete(path);
    dirtyFiles.delete(path);
}

export async function syncToWorkspace(getSessionId: () => string | null): Promise<{ synced: number; errors: string[] }> {
    const sessionId = getSessionId();
    const errors: string[] = [];
    let synced = 0;
    
    if (!sessionId) {
        return { synced: 0, errors: ["No active workspace session"] };
    }
    
    const files = Array.from(dirtyFiles);
    
    for (const path of files) {
        const file = syncedFiles.get(path);
        if (!file) continue;
        
        try {
            const now = Date.now();
            file.syncedAt = now;
            
            const database = await openSyncDB();
            const tx = database.transaction(SYNC_STORE_NAME, "readwrite");
            const store = tx.objectStore(SYNC_STORE_NAME);
            
            await new Promise<void>((resolve, reject) => {
                const request = store.put(file);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
            
            dirtyFiles.delete(path);
            synced++;
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            errors.push(`${path}: ${msg}`);
        }
    }
    
    return { synced, errors };
}

async function loadAllSyncedFiles(): Promise<void> {
    const database = await openSyncDB();
    const tx = database.transaction(SYNC_STORE_NAME, "readonly");
    const store = tx.objectStore(SYNC_STORE_NAME);
    
    await new Promise<void>((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => {
            const files: SyncedFile[] = request.result || [];
            files.forEach(f => syncedFiles.set(f.path, f));
            resolve();
        };
        request.onerror = () => reject(request.error);
    });
}

async function hashContent(content: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

export function getSyncStatus(): { dirty: number; synced: number } {
    return {
        dirty: dirtyFiles.size,
        synced: syncedFiles.size - dirtyFiles.size
    };
}

export function listSyncedFiles(): string[] {
    return Array.from(syncedFiles.keys());
}

export function isFileSynced(path: string): boolean {
    const file = syncedFiles.get(path);
    return file ? file.syncedAt > 0 : false;
}

export function isFileDirty(path: string): boolean {
    return dirtyFiles.has(path);
}

export function startBackgroundSync(getSessionId: () => string | null): void {
    if (syncInterval) clearInterval(syncInterval);
    
    syncInterval = setInterval(() => {
        (async () => {
            if (dirtyFiles.size > 0) {
                await syncToWorkspace(getSessionId);
            }
        })();
    }, SYNC_INTERVAL_MS);
}

export function stopBackgroundSync(): void {
    if (syncInterval) {
        clearInterval(syncInterval);
        syncInterval = null;
    }
}

export async function clearAllSyncedFiles(): Promise<void> {
    const database = await openSyncDB();
    const tx = database.transaction(SYNC_STORE_NAME, "readwrite");
    const store = tx.objectStore(SYNC_STORE_NAME);
    
    await new Promise<void>((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
    
    syncedFiles.clear();
    dirtyFiles.clear();
}

export { openSyncDB };

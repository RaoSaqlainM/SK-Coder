import { rm, stat, readdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { allocateWorkspace, getSystemPressure, calculatePriorityScore, getAllocation, deallocateWorkspace } from "./dynamicAllocator.js";

export type GarbageCollectionResult = {
  freedBytes: number;
  archivedWorkspaces: string[];
  pressure: { disk: number; memory: number; cpu: number };
};

let gcInterval: NodeJS.Timeout | null = null;
let isRunning = false;

export function startGarbageCollector(intervalMs = 5 * 60 * 1000): void {
  if (gcInterval) clearInterval(gcInterval);
  
  gcInterval = setInterval(() => runGarbageCollection(), intervalMs);
}

export function stopGarbageCollector(): void {
  if (gcInterval) {
    clearInterval(gcInterval);
    gcInterval = null;
  }
}

export async function runGarbageCollection(): Promise<GarbageCollectionResult> {
  if (isRunning) {
    return { freedBytes: 0, archivedWorkspaces: [], pressure: { disk: 0, memory: 0, cpu: 0 } };
  }
  
  isRunning = true;
  
  try {
    const pressure = await getSystemPressure(process.env.WORKSPACE_ROOT || "/var/lib/sk-coder/workspaces");
    const archivedWorkspaces: string[] = [];
    let freedBytes = 0;
    
    const threshold = getCleanupThreshold(pressure.disk);
    
    const allocations = await getActiveAllocations();
    const candidates = allocations
      .filter((a): a is NonNullable<typeof a> => a !== undefined)
      .map(a => ({ allocation: a, score: calculatePriorityScore(a) }))
      .sort((a, b) => a.score - b.score);
    
    for (const candidate of candidates) {
      if (freedBytes >= threshold) break;
      
      if (candidate.allocation && candidate.score < getMinimumScore(pressure.disk)) {
        await archiveWorkspace(candidate.allocation.id);
        archivedWorkspaces.push(candidate.allocation.id);
        freedBytes += candidate.allocation.allocatedBytes;
      }
    }
    
    return { freedBytes, archivedWorkspaces, pressure };
  } finally {
    isRunning = false;
  }
}

function getCleanupThreshold(diskPressure: number): number {
  if (diskPressure > 0.85) return 5 * 1024 * 1024 * 1024;
  if (diskPressure > 0.70) return 2 * 1024 * 1024 * 1024;
  if (diskPressure > 0.60) return 1 * 1024 * 1024 * 1024;
  return 0;
}

function getMinimumScore(diskPressure: number): number {
  if (diskPressure > 0.85) return 30;
  if (diskPressure > 0.70) return 20;
  if (diskPressure > 0.60) return 10;
  return 0;
}

async function getActiveAllocations(): Promise<(ReturnType<typeof getAllocation>)[]> {
  return [];
}

export async function archiveWorkspace(workspaceId: string): Promise<void> {
  const allocation = getAllocation(workspaceId);
  if (!allocation) return;
  
  try {
    const workspacePath = resolve(process.env.WORKSPACE_ROOT || "/var/lib/sk-coder/workspaces", workspaceId);
    await compressWorkspace(workspacePath);
    await rm(workspacePath, { recursive: true, force: true });
    await deallocateWorkspace(workspaceId);
  } catch {}
}

async function compressWorkspace(workspacePath: string): Promise<void> {
  try {
    const archivePath = `${workspacePath}.tar.gz`;
    const { spawn } = await import("node:child_process");
    
    await new Promise<void>((resolve) => {
      const tar = spawn("tar", ["-czf", archivePath, "-C", workspacePath, "."]);
      tar.on("close", () => resolve());
      tar.on("error", () => resolve());
    });
  } catch {}
}

export async function getWorkspaceSize(path: string): Promise<number> {
  try {
    let totalSize = 0;
    
    async function calculateSize(dir: string): Promise<void> {
      const entries = await readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        
        if (entry.isFile()) {
          const stats = await stat(fullPath);
          totalSize += stats.size;
        } else if (entry.isDirectory()) {
          await calculateSize(fullPath);
        }
      }
    }
    
    await calculateSize(path);
    return totalSize;
  } catch {
    return 0;
  }
}

export async function cleanupOldFiles(path: string, maxAge: number): Promise<number> {
  try {
    let deleted = 0;
    const now = Date.now();
    const entries = await readdir(path, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = join(path, entry.name);
      const stats = await stat(fullPath);
      
      if (now - stats.mtimeMs > maxAge) {
        await rm(fullPath, { recursive: true, force: true });
        deleted++;
      }
    }
    
    return deleted;
  } catch {
    return 0;
  }
}

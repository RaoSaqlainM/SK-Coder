import { stat, readdir, rm, mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

export type WorkspaceAllocation = {
  id: string;
  userId: string;
  allocatedBytes: number;
  usedBytes: number;
  createdAt: number;
  lastActivity: number;
  expiresAt: number;
};

export type SystemPressure = {
  disk: number;
  memory: number;
  cpu: number;
};

const TOTAL_POOL_BYTES = 40 * 1024 * 1024 * 1024;
const EMERGENCY_RESERVE_BYTES = 10 * 1024 * 1024 * 1024;
const MAX_ALLOCATION_BYTES = 5 * 1024 * 1024 * 1024;
const WORKSPACE_TTL_MS = 72 * 60 * 60 * 1000;

const allocations = new Map<string, WorkspaceAllocation>();
let totalAllocated = 0;

export async function allocateWorkspace(id: string, userId: string, requestedBytes: number): Promise<WorkspaceAllocation> {
  const available = TOTAL_POOL_BYTES - EMERGENCY_RESERVE_BYTES - totalAllocated;
  
  if (requestedBytes > MAX_ALLOCATION_BYTES) {
    throw new Error(`Workspace exceeds maximum size limit`);
  }
  
  if (requestedBytes > available) {
    await cleanupInactiveWorkspaces(requestedBytes - available);
  }
  
  const allocation: WorkspaceAllocation = {
    id,
    userId,
    allocatedBytes: requestedBytes,
    usedBytes: 0,
    createdAt: Date.now(),
    lastActivity: Date.now(),
    expiresAt: Date.now() + WORKSPACE_TTL_MS
  };
  
  allocations.set(id, allocation);
  totalAllocated += requestedBytes;
  
  return allocation;
}

export function updateWorkspaceUsage(id: string, usedBytes: number): void {
  const allocation = allocations.get(id);
  if (allocation) {
    const delta = usedBytes - allocation.usedBytes;
    allocation.usedBytes = usedBytes;
    totalAllocated += delta;
    allocation.lastActivity = Date.now();
  }
}

export function touchWorkspace(id: string): void {
  const allocation = allocations.get(id);
  if (allocation) {
    allocation.lastActivity = Date.now();
  }
}

export async function deallocateWorkspace(id: string): Promise<void> {
  const allocation = allocations.get(id);
  if (allocation) {
    totalAllocated -= allocation.allocatedBytes;
    allocations.delete(id);
  }
}

export function getAllocation(id: string): WorkspaceAllocation | undefined {
  return allocations.get(id);
}

export function getAllocationsByUser(userId: string): WorkspaceAllocation[] {
  return Array.from(allocations.values()).filter(a => a.userId === userId);
}

export function getTotalAllocated(): number {
  return totalAllocated;
}

export function getAvailableSpace(): number {
  return TOTAL_POOL_BYTES - EMERGENCY_RESERVE_BYTES - totalAllocated;
}

export async function cleanupInactiveWorkspaces(spaceNeeded: number): Promise<number> {
  const sorted = Array.from(allocations.values())
    .sort((a, b) => a.lastActivity - b.lastActivity);
  
  let freed = 0;
  const now = Date.now();
  
  for (const allocation of sorted) {
    if (freed >= spaceNeeded) break;
    
    const hoursSinceActivity = (now - allocation.lastActivity) / (1000 * 60 * 60);
    
    if (hoursSinceActivity > 1) {
      await deallocateWorkspace(allocation.id);
      freed += allocation.allocatedBytes;
    }
  }
  
  return freed;
}

export async function getSystemPressure(workspaceRoot: string): Promise<SystemPressure> {
  const disk = await getDiskPressure(workspaceRoot);
  const memory = await getMemoryPressure();
  const cpu = await getCPUPressure();
  
  return { disk, memory, cpu };
}

async function getDiskPressure(workspaceRoot: string): Promise<number> {
  try {
    const files = await readdir(workspaceRoot, { withFileTypes: true });
    let totalSize = 0;
    
    for (const file of files) {
      if (file.isFile()) {
        const stats = await stat(resolve(workspaceRoot, file.name));
        totalSize += stats.size;
      }
    }
    
    return totalSize / TOTAL_POOL_BYTES;
  } catch {
    return 0;
  }
}

async function getMemoryPressure(): Promise<number> {
  try {
    const result = await readFile("/proc/meminfo", "utf-8");
    const lines = result.split("\n");
    const memTotal = parseInt(lines.find((l: string) => l.startsWith("MemTotal:"))?.split(/\s+/)[1] || "0") * 1024;
    const memAvailable = parseInt(lines.find((l: string) => l.startsWith("MemAvailable:"))?.split(/\s+/)[1] || "0") * 1024;
    
    return memAvailable / memTotal;
  } catch {
    return 0.5;
  }
}

async function getCPUPressure(): Promise<number> {
  try {
    const result = await readFile("/proc/loadavg", "utf-8");
    const load1 = parseFloat(result.split(" ")[0]);
    const cpuinfo = await readFile("/proc/cpuinfo", "utf-8");
    const cpuCount = cpuinfo.split("\n").filter((l: string) => l.startsWith("processor")).length;
    
    return load1 / cpuCount;
  } catch {
    return 0.5;
  }
}

export function calculatePriorityScore(allocation: WorkspaceAllocation): number {
  const now = Date.now();
  const hoursSinceActivity = (now - allocation.lastActivity) / (1000 * 60 * 60);
  
  let score = 0;
  
  if (hoursSinceActivity < 1) score += 50;
  else if (hoursSinceActivity < 6) score += 30;
  else if (hoursSinceActivity < 24) score += 10;
  
  const sizeMB = allocation.usedBytes / (1024 * 1024);
  if (sizeMB > 100) score += 20;
  else if (sizeMB > 10) score += 10;
  
  return score;
}

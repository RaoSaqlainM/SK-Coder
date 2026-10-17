import { spawn } from "node:child_process";

export type ContainerPriority = "high" | "medium" | "low";
export type ContainerState = "queued" | "running" | "completed";

export type ScheduledContainer = {
  id: string;
  priority: ContainerPriority;
  cpuLimit: number;
  memoryLimitMB: number;
  state: ContainerState;
  queuePosition?: number;
};

const MAX_SYSTEM_LOAD = 3.5;
const CPU_CORES = 4;

const queue: ScheduledContainer[] = [];
const running: Map<string, ScheduledContainer> = new Map();

export async function getSystemLoad(): Promise<number> {
  try {
    const proc = spawn("cat", ["/proc/loadavg"]);
    let output = "";
    
    return new Promise((resolve) => {
      proc.stdout?.on("data", (data) => output += data.toString());
      proc.on("close", () => {
        const load1 = parseFloat(output.split(" ")[0]);
        resolve(load1);
      });
      proc.on("error", () => resolve(0));
    });
  } catch {
    return 0;
  }
}

export async function scheduleContainer(containerId: string, priority: ContainerPriority): Promise<ScheduledContainer> {
  const currentLoad = await getSystemLoad();
  
  if (currentLoad > MAX_SYSTEM_LOAD && running.size >= 2) {
    const queued: ScheduledContainer = {
      id: containerId,
      priority,
      cpuLimit: 0,
      memoryLimitMB: 0,
      state: "queued",
      queuePosition: queue.length + 1
    };
    queue.push(queued);
    return queued;
  }
  
  const cpuLimit = calculateCPULimit(priority, currentLoad);
  const memoryLimitMB = calculateMemoryLimit(priority, currentLoad);
  
  const container: ScheduledContainer = {
    id: containerId,
    priority,
    cpuLimit,
    memoryLimitMB,
    state: "running"
  };
  
  running.set(containerId, container);
  
  return container;
}

function calculateCPULimit(priority: ContainerPriority, currentLoad: number): number {
  const baseLimits = {
    high: 0.75,
    medium: 0.5,
    low: 0.25
  };
  
  let limit = baseLimits[priority];
  
  if (currentLoad > 3.0) limit *= 0.5;
  else if (currentLoad > 2.5) limit *= 0.7;
  else if (currentLoad > 2.0) limit *= 0.85;
  
  return limit;
}

function calculateMemoryLimit(priority: ContainerPriority, currentLoad: number): number {
  const baseMemory = {
    high: 1024,
    medium: 512,
    low: 256
  };
  
  let limit = baseMemory[priority];
  
  if (currentLoad > 3.0) limit = Math.floor(limit * 0.6);
  else if (currentLoad > 2.0) limit = Math.floor(limit * 0.8);
  
  return limit;
}

export function completeContainer(containerId: string): void {
  running.delete(containerId);
  
  if (queue.length > 0) {
    const next = queue.shift();
    if (next) {
      (async () => {
        const load = await getSystemLoad();
        const cpuLimit = calculateCPULimit(next.priority, load);
        const memoryLimitMB = calculateMemoryLimit(next.priority, load);
        
        next.cpuLimit = cpuLimit;
        next.memoryLimitMB = memoryLimitMB;
        next.state = "running";
        next.queuePosition = undefined;
        
        running.set(next.id, next);
      })();
    }
  }
}

export function getQueuePosition(containerId: string): number {
  const index = queue.findIndex(c => c.id === containerId);
  return index >= 0 ? index + 1 : 0;
}

export function getQueueLength(): number {
  return queue.length;
}

export function getRunningCount(): number {
  return running.size;
}

export function getContainerState(containerId: string): ContainerState | undefined {
  const container = running.get(containerId) || queue.find(c => c.id === containerId);
  return container?.state;
}

export function getContainerResources(containerId: string): { cpuLimit: number; memoryLimitMB: number } | undefined {
  const container = running.get(containerId);
  if (container) {
    return {
      cpuLimit: container.cpuLimit,
      memoryLimitMB: container.memoryLimitMB
    };
  }
  return undefined;
}

export async function optimizeContainers(): Promise<void> {
  const currentLoad = await getSystemLoad();
  
  for (const [id, container] of running) {
    const newCpuLimit = calculateCPULimit(container.priority, currentLoad);
    const newMemoryLimit = calculateMemoryLimit(container.priority, currentLoad);
    
    container.cpuLimit = newCpuLimit;
    container.memoryLimitMB = newMemoryLimit;
  }
}

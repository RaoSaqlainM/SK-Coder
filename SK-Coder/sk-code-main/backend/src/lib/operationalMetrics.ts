import { execFile } from "node:child_process";
import { cpus, loadavg, uptime } from "node:os";
import { readFile, statfs } from "node:fs/promises";
import { promisify } from "node:util";
import { WORKSPACE_ROOT } from "./backendConfig.js";
import { sharedCapacitySummary, listSharedCapacityReservations } from "./capacityLedger.js";
import { listRuntimeOperations } from "./operationRegistry.js";

const execFileAsync = promisify(execFile);
type Snapshot = { generatedAt: number; reservedBytes: number; actualBytes: number; diskUsedBytes: number; memoryUsedBytes: number; load1: number };
const snapshots: Snapshot[] = [];

function parseMemInfo(value: string) {
    const values = new Map(value.split("\n").map((line) => {
        const [key, raw] = line.split(":", 2);
        return [key, Number(raw?.trim().split(/\s+/)[0]) * 1024];
    }));
    const totalBytes = values.get("MemTotal") || 0;
    const availableBytes = values.get("MemAvailable") || values.get("MemFree") || 0;
    return { totalBytes, availableBytes, usedBytes: Math.max(0, totalBytes - availableBytes) };
}

async function dockerStats() {
    try {
        const { stdout } = await execFileAsync("docker", ["stats", "--no-stream", "--format", "{{.Name}}|{{.CPUPerc}}|{{.MemUsage}}|{{.PIDs}}"], { timeout: 5000, maxBuffer: 1024 * 1024 });
        return stdout.split("\n").filter(Boolean).map((line) => {
            const [name, cpu, memory, pids] = line.split("|", 4);
            return { name, cpu, memory, pids: Number(pids) || 0 };
        }).filter((entry) => entry.name.startsWith("skcoder-"));
    }
    catch {
        return [];
    }
}

export async function getHostPressure() {
    const [meminfo, filesystem] = await Promise.all([
        readFile("/proc/meminfo", "utf8").catch(() => ""),
        statfs(WORKSPACE_ROOT).catch(() => null),
    ]);
    const memory = parseMemInfo(meminfo);
    const diskTotalBytes = filesystem ? Number(filesystem.blocks) * Number(filesystem.bsize) : 0;
    const diskFreeBytes = filesystem ? Number(filesystem.bavail) * Number(filesystem.bsize) : 0;
    return {
        memory,
        disk: { totalBytes: diskTotalBytes, freeBytes: diskFreeBytes, usedBytes: Math.max(0, diskTotalBytes - diskFreeBytes) },
        cpu: { logicalCpus: cpus().length, load1: loadavg()[0] || 0, load5: loadavg()[1] || 0, load15: loadavg()[2] || 0 },
        uptimeSeconds: uptime(),
    };
}

export async function collectOperationalMetrics() {
    const [host, capacity, operations, reservations, containers] = await Promise.all([getHostPressure(), sharedCapacitySummary(), listRuntimeOperations(), listSharedCapacityReservations(), dockerStats()]);
    const byKind = new Map<string, { reservedBytes: number; actualBytes: number; active: number }>();
    for (const reservation of reservations) {
        if (reservation.state === "released") continue;
        const entry = byKind.get(reservation.kind) || { reservedBytes: 0, actualBytes: 0, active: 0 };
        entry.reservedBytes += reservation.reservedBytes;
        entry.actualBytes += reservation.actualBytes;
        entry.active += 1;
        byKind.set(reservation.kind, entry);
    }
    const snapshot = { generatedAt: Date.now(), reservedBytes: capacity.reservedBytes, actualBytes: capacity.actualBytes, diskUsedBytes: host.disk.usedBytes, memoryUsedBytes: host.memory.usedBytes, load1: host.cpu.load1 };
    snapshots.push(snapshot);
    if (snapshots.length > 120) snapshots.splice(0, snapshots.length - 120);
    return {
        generatedAt: snapshot.generatedAt,
        host,
        sharedPool: { ...capacity, byKind: [...byKind.entries()].map(([kind, value]) => ({ kind, ...value })) },
        operations: {
            active: operations.filter((operation) => operation.state === "active" || operation.state === "finalizing").length,
            cleanupFailed: operations.filter((operation) => operation.state === "cleanup-failed").length,
            finalized: operations.filter((operation) => operation.state === "finalized").length,
            expired: operations.filter((operation) => operation.expiresAt <= snapshot.generatedAt && operation.state !== "finalized").length,
        },
        containers,
        history: [...snapshots],
    };
}

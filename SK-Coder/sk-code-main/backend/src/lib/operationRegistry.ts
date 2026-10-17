import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { OPERATION_METADATA_PATH, RUNNER_SCRATCH_MAX_BYTES, SESSION_MAX_BYTES, STAGING_MAX_BYTES, WORKSPACE_INITIAL_RESERVATION_BYTES } from "./backendConfig.js";
import { beginSharedCapacityRelease, completeSharedCapacityRelease, failSharedCapacityRelease, reserveSharedCapacity, updateSharedCapacityExpiry } from "./capacityLedger.js";

export type RuntimeOperationKind = "workplace" | "terminal" | "staging" | "runner" | "installer" | "apk" | "artifact" | "gui" | "preview";
export type RuntimeOperationState = "active" | "finalizing" | "finalized" | "cleanup-failed";
export type RuntimeOperation = {
    id: string;
    ownerId: string;
    kind: RuntimeOperationKind;
    resources: string[];
    createdAt: number;
    expiresAt: number;
    reservationBytes: number;
    state: RuntimeOperationState;
    cleanupError: string | null;
};
type OperationRegistry = {
    version: 1;
    records: RuntimeOperation[];
};

let registryCache: OperationRegistry | null = null;
let writeQueue = Promise.resolve();

function defaultRegistry(): OperationRegistry {
    return { version: 1, records: [] };
}

function defaultReservationBytes(kind: RuntimeOperationKind) {
    if (kind === "workplace") return WORKSPACE_INITIAL_RESERVATION_BYTES;
    if (kind === "terminal") return SESSION_MAX_BYTES;
    if (kind === "staging") return STAGING_MAX_BYTES;
    if (kind === "runner" || kind === "installer") return RUNNER_SCRATCH_MAX_BYTES;
    if (kind === "apk") return Math.min(STAGING_MAX_BYTES, 3 * 1024 * 1024 * 1024);
    if (kind === "gui" || kind === "preview") return Math.min(STAGING_MAX_BYTES, 2 * 1024 * 1024 * 1024);
    return Math.min(STAGING_MAX_BYTES, 1024 * 1024 * 1024);
}

function normalizeRecord(record: RuntimeOperation) {
    return { ...record, reservationBytes: Number.isSafeInteger(record.reservationBytes) && record.reservationBytes >= 0 ? record.reservationBytes : defaultReservationBytes(record.kind) };
}

async function readRegistry() {
    if (registryCache) return registryCache;
    try {
        const parsed = JSON.parse(await readFile(OPERATION_METADATA_PATH, "utf8")) as OperationRegistry;
        registryCache = parsed?.version === 1 && Array.isArray(parsed.records) ? { version: 1, records: parsed.records.map(normalizeRecord) } : defaultRegistry();
    }
    catch {
        registryCache = defaultRegistry();
    }
    return registryCache;
}

async function persistRegistry() {
    const registry = await readRegistry();
    await mkdir(dirname(OPERATION_METADATA_PATH), { recursive: true, mode: 0o700 });
    const temporaryPath = join(dirname(OPERATION_METADATA_PATH), `.operations-${randomUUID()}.json`);
    await writeFile(temporaryPath, JSON.stringify(registry), { encoding: "utf8", mode: 0o600 });
    await rename(temporaryPath, OPERATION_METADATA_PATH);
}

function queuePersist() {
    writeQueue = writeQueue.then(() => persistRegistry());
    return writeQueue;
}

export function operationCanFinalize(operation: RuntimeOperation | null | undefined, ownerId: string, kind?: RuntimeOperationKind) {
    return Boolean(operation && operation.ownerId === ownerId && operation.state !== "finalized" && (!kind || operation.kind === kind));
}

export function operationNeedsRecovery(operation: RuntimeOperation, now = Date.now()) {
    return operation.kind !== "terminal" && operation.kind !== "workplace" && operation.expiresAt <= now && operation.state !== "finalized";
}

export async function createRuntimeOperation(operation: Omit<RuntimeOperation, "createdAt" | "state" | "cleanupError" | "reservationBytes"> & { reservationBytes?: number }) {
    if (!operation.id || !operation.ownerId || !Array.isArray(operation.resources) || operation.resources.some((resource) => !resource))
        throw new Error("Runtime operation requires an exact operation, owner, and resource list.");
    const reservationBytes = operation.reservationBytes ?? defaultReservationBytes(operation.kind);
    if (!Number.isSafeInteger(reservationBytes) || reservationBytes < 0)
        throw new Error("Runtime operation requires a non-negative bounded shared-capacity reservation.");
    if (reservationBytes > 0)
        await reserveSharedCapacity({ id: operation.id, ownerId: operation.ownerId, kind: operation.kind, reservedBytes: reservationBytes, expiresAt: operation.expiresAt });
    const registry = await readRegistry();
    try {
        const record: RuntimeOperation = { ...operation, reservationBytes, resources: [...new Set(operation.resources)], createdAt: Date.now(), state: "active", cleanupError: null };
        registry.records = [...registry.records.filter((item) => item.id !== record.id), record];
        await queuePersist();
        return record;
    }
    catch (error) {
        if (reservationBytes > 0) {
            await beginSharedCapacityRelease(operation.id, operation.ownerId);
            await completeSharedCapacityRelease(operation.id, operation.ownerId);
        }
        throw error;
    }
}

export async function getRuntimeOperation(id: string) {
    return (await readRegistry()).records.find((record) => record.id === id) ?? null;
}

export async function updateRuntimeOperationExpiry(id: string, ownerId: string, expiresAt: number) {
    if (!Number.isSafeInteger(expiresAt) || expiresAt <= Date.now())
        throw new Error("Runtime operation expiry must be a future timestamp.");
    const registry = await readRegistry();
    const record = registry.records.find((item) => item.id === id);
    if (!record || record.ownerId !== ownerId || record.state === "finalized")
        return null;
    record.expiresAt = expiresAt;
    await queuePersist();
    await updateSharedCapacityExpiry(id, ownerId, expiresAt);
    return record;
}

export async function beginRuntimeOperationFinalization(id: string, ownerId: string, kind?: RuntimeOperationKind) {
    const registry = await readRegistry();
    const record = registry.records.find((item) => item.id === id);
    if (!record || !operationCanFinalize(record, ownerId, kind)) return null;
    record.state = "finalizing";
    record.cleanupError = null;
    await queuePersist();
    if (record.reservationBytes > 0)
        await beginSharedCapacityRelease(id, ownerId);
    return record;
}

export async function completeRuntimeOperationFinalization(id: string, ownerId: string, kind?: RuntimeOperationKind) {
    const registry = await readRegistry();
    const record = registry.records.find((item) => item.id === id);
    if (!record || record.ownerId !== ownerId || (kind && record.kind !== kind)) return null;
    record.state = "finalized";
    record.cleanupError = null;
    await queuePersist();
    if (record.reservationBytes > 0)
        await completeSharedCapacityRelease(id, ownerId);
    return record;
}

export async function failRuntimeOperationFinalization(id: string, ownerId: string, error: unknown) {
    const registry = await readRegistry();
    const record = registry.records.find((item) => item.id === id);
    if (!record || record.ownerId !== ownerId) return null;
    record.state = "cleanup-failed";
    record.cleanupError = error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500);
    await queuePersist();
    if (record.reservationBytes > 0)
        await failSharedCapacityRelease(id, ownerId, error);
    return record;
}

export async function listRuntimeOperations(ownerId?: string) {
    const records = (await readRegistry()).records;
    return ownerId ? records.filter((record) => record.ownerId === ownerId) : [...records];
}

export async function listExpiredRuntimeOperations(now = Date.now()) {
    return (await listRuntimeOperations()).filter((record) => operationNeedsRecovery(record, now));
}

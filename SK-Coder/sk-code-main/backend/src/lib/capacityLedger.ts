import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { CAPACITY_LEDGER_PATH, SHARED_POOL_ADMISSION_BYTES, SHARED_POOL_MAX_BYTES } from "./backendConfig.js";

export type CapacityReservationKind = "workplace" | "terminal" | "staging" | "runner" | "installer" | "apk" | "artifact" | "gui" | "preview";
export type CapacityReservationState = "active" | "releasing" | "released" | "release-failed";
export type CapacityReservation = {
    id: string;
    ownerId: string;
    kind: CapacityReservationKind;
    reservedBytes: number;
    actualBytes: number;
    createdAt: number;
    expiresAt: number;
    state: CapacityReservationState;
    releaseError: string | null;
};
type CapacityLedger = {
    version: 1;
    records: CapacityReservation[];
};

let cachedLedger: CapacityLedger | null = null;
let writeQueue = Promise.resolve();

function defaultLedger(): CapacityLedger {
    return { version: 1, records: [] };
}

async function readLedger() {
    if (cachedLedger) return cachedLedger;
    try {
        const parsed = JSON.parse(await readFile(CAPACITY_LEDGER_PATH, "utf8")) as CapacityLedger;
        cachedLedger = parsed?.version === 1 && Array.isArray(parsed.records) ? parsed : defaultLedger();
    }
    catch {
        cachedLedger = defaultLedger();
    }
    return cachedLedger;
}

async function persistLedger() {
    const ledger = await readLedger();
    await mkdir(dirname(CAPACITY_LEDGER_PATH), { recursive: true, mode: 0o700 });
    const temporaryPath = join(dirname(CAPACITY_LEDGER_PATH), ".capacity-ledger-next.json");
    await writeFile(temporaryPath, JSON.stringify(ledger), { encoding: "utf8", mode: 0o600 });
    await rename(temporaryPath, CAPACITY_LEDGER_PATH);
}

function queueWrite<T>(work: () => Promise<T>) {
    const next = writeQueue.then(work, work);
    writeQueue = next.then(() => undefined, () => undefined);
    return next;
}

function isCommitted(record: CapacityReservation) {
    return record.state === "active" || record.state === "releasing" || record.state === "release-failed";
}

function committedBytes(records: CapacityReservation[]) {
    return records.filter(isCommitted).reduce((total, record) => total + record.reservedBytes, 0);
}

function validateReservationInput(input: Omit<CapacityReservation, "actualBytes" | "createdAt" | "state" | "releaseError">) {
    if (!input.id || !input.ownerId || !Number.isSafeInteger(input.reservedBytes) || input.reservedBytes <= 0 || !Number.isSafeInteger(input.expiresAt) || input.expiresAt <= Date.now())
        throw new Error("Shared capacity requires an exact operation, owner, positive byte reservation, and future expiry.");
}

export function canAdmitSharedReservation(currentReservedBytes: number, requestedBytes: number, admissionBytes = SHARED_POOL_ADMISSION_BYTES) {
    return Number.isSafeInteger(currentReservedBytes) && Number.isSafeInteger(requestedBytes) && requestedBytes > 0 && currentReservedBytes + requestedBytes <= admissionBytes;
}

export function canExtendSharedReservation(currentReservedBytes: number, requestedBytes: number, maximumBytes = SHARED_POOL_MAX_BYTES) {
    return Number.isSafeInteger(currentReservedBytes) && Number.isSafeInteger(requestedBytes) && requestedBytes > 0 && currentReservedBytes + requestedBytes <= maximumBytes;
}

export async function reserveSharedCapacity(input: Omit<CapacityReservation, "actualBytes" | "createdAt" | "state" | "releaseError">) {
    validateReservationInput(input);
    return queueWrite(async () => {
        const ledger = await readLedger();
        const existing = ledger.records.find((record) => record.id === input.id && isCommitted(record));
        if (existing) {
            if (existing.ownerId === input.ownerId && existing.kind === input.kind)
                return existing;
            throw new Error("Shared capacity is already reserved for a different operation.");
        }
        const currentReservedBytes = committedBytes(ledger.records);
        if (!canAdmitSharedReservation(currentReservedBytes, input.reservedBytes))
            throw new Error("Shared server workspace capacity is busy. Source files remain available in browser storage while this server operation waits.");
        const reservation: CapacityReservation = { ...input, actualBytes: 0, createdAt: Date.now(), state: "active", releaseError: null };
        ledger.records = [...ledger.records.filter((record) => record.id !== input.id), reservation];
        await persistLedger();
        return reservation;
    });
}

export async function extendSharedCapacity(id: string, ownerId: string, additionalBytes: number) {
    if (!id || !ownerId || !Number.isSafeInteger(additionalBytes) || additionalBytes <= 0)
        throw new Error("Shared capacity extension requires an exact operation, owner, and positive byte request.");
    return queueWrite(async () => {
        const ledger = await readLedger();
        const reservation = ledger.records.find((record) => record.id === id);
        if (!reservation || reservation.ownerId !== ownerId || reservation.state !== "active")
            throw new Error("Only an active owned operation can extend shared capacity.");
        const currentReservedBytes = committedBytes(ledger.records);
        if (!canExtendSharedReservation(currentReservedBytes, additionalBytes))
            throw new Error("The shared extension margin is currently reserved by other active work. Finish or retry after capacity is released.");
        reservation.reservedBytes += additionalBytes;
        await persistLedger();
        return reservation;
    });
}

export async function reconcileSharedCapacity(id: string, ownerId: string, requiredBytes: number, actualBytes = requiredBytes) {
    if (!id || !ownerId || !Number.isSafeInteger(requiredBytes) || requiredBytes <= 0 || !Number.isSafeInteger(actualBytes) || actualBytes < 0)
        throw new Error("Shared capacity reconciliation requires an exact operation, owner, and positive bounded reservation.");
    return queueWrite(async () => {
        const ledger = await readLedger();
        const reservation = ledger.records.find((record) => record.id === id);
        if (!reservation || reservation.ownerId !== ownerId || reservation.state !== "active")
            throw new Error("Only an active owned operation can reconcile shared capacity.");
        const currentReservedBytes = committedBytes(ledger.records);
        const additionalBytes = Math.max(0, requiredBytes - reservation.reservedBytes);
        if (additionalBytes > 0 && !canExtendSharedReservation(currentReservedBytes, additionalBytes))
            throw new Error("The shared server workplace capacity is busy. Existing work remains protected while this workspace waits for capacity.");
        reservation.reservedBytes = requiredBytes;
        reservation.actualBytes = Math.min(actualBytes, requiredBytes);
        await persistLedger();
        return reservation;
    });
}

export async function reportSharedCapacityUsage(id: string, ownerId: string, actualBytes: number) {
    if (!Number.isSafeInteger(actualBytes) || actualBytes < 0)
        throw new Error("Shared capacity usage must be a non-negative byte value.");
    return queueWrite(async () => {
        const ledger = await readLedger();
        const reservation = ledger.records.find((record) => record.id === id);
        if (!reservation || reservation.ownerId !== ownerId || !isCommitted(reservation))
            return null;
        reservation.actualBytes = Math.min(actualBytes, reservation.reservedBytes);
        await persistLedger();
        return reservation;
    });
}

export async function updateSharedCapacityExpiry(id: string, ownerId: string, expiresAt: number) {
    if (!Number.isSafeInteger(expiresAt) || expiresAt <= Date.now())
        throw new Error("Shared capacity expiry must be a future timestamp.");
    return queueWrite(async () => {
        const ledger = await readLedger();
        const reservation = ledger.records.find((record) => record.id === id);
        if (!reservation || reservation.ownerId !== ownerId || !isCommitted(reservation))
            return null;
        reservation.expiresAt = expiresAt;
        await persistLedger();
        return reservation;
    });
}

export async function beginSharedCapacityRelease(id: string, ownerId: string) {
    return queueWrite(async () => {
        const ledger = await readLedger();
        const reservation = ledger.records.find((record) => record.id === id);
        if (!reservation || reservation.ownerId !== ownerId || reservation.state === "released")
            return null;
        reservation.state = "releasing";
        reservation.releaseError = null;
        await persistLedger();
        return reservation;
    });
}

export async function completeSharedCapacityRelease(id: string, ownerId: string) {
    return queueWrite(async () => {
        const ledger = await readLedger();
        const reservation = ledger.records.find((record) => record.id === id);
        if (!reservation || reservation.ownerId !== ownerId)
            return null;
        reservation.state = "released";
        reservation.actualBytes = 0;
        reservation.releaseError = null;
        await persistLedger();
        return reservation;
    });
}

export async function failSharedCapacityRelease(id: string, ownerId: string, error: unknown) {
    return queueWrite(async () => {
        const ledger = await readLedger();
        const reservation = ledger.records.find((record) => record.id === id);
        if (!reservation || reservation.ownerId !== ownerId || reservation.state === "released")
            return null;
        reservation.state = "release-failed";
        reservation.releaseError = error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500);
        await persistLedger();
        return reservation;
    });
}

export async function listSharedCapacityReservations(ownerId?: string) {
    const records = (await readLedger()).records;
    return ownerId ? records.filter((record) => record.ownerId === ownerId) : [...records];
}

export async function sharedCapacitySummary() {
    const records = await listSharedCapacityReservations();
    const reservedBytes = committedBytes(records);
    const actualBytes = records.filter(isCommitted).reduce((total, record) => total + record.actualBytes, 0);
    return {
        maximumBytes: SHARED_POOL_MAX_BYTES,
        admissionBytes: SHARED_POOL_ADMISSION_BYTES,
        extensionBytes: Math.max(0, SHARED_POOL_MAX_BYTES - SHARED_POOL_ADMISSION_BYTES),
        reservedBytes,
        actualBytes,
        availableAdmissionBytes: Math.max(0, SHARED_POOL_ADMISSION_BYTES - reservedBytes),
        availableExtensionBytes: Math.max(0, SHARED_POOL_MAX_BYTES - reservedBytes),
        activeReservations: records.filter((record) => record.state === "active").length,
        releaseFailures: records.filter((record) => record.state === "release-failed").length,
    };
}

export async function resetSharedCapacityLedgerForTest() {
    return queueWrite(async () => {
        cachedLedger = defaultLedger();
        await rm(CAPACITY_LEDGER_PATH, { force: true });
    });
}

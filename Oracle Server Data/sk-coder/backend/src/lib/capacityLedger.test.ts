import { afterEach, describe, expect, it } from "vitest";
import { beginSharedCapacityRelease, canAdmitSharedReservation, canExtendSharedReservation, completeSharedCapacityRelease, listSharedCapacityReservations, reconcileSharedCapacity, reserveSharedCapacity, resetSharedCapacityLedgerForTest, sharedCapacitySummary } from "./capacityLedger.js";

describe("shared capacity admission", () => {
    afterEach(async () => {
        await resetSharedCapacityLedgerForTest();
    });
    it("admits new work through the 48 GiB normal threshold", () => {
        expect(canAdmitSharedReservation(47 * 1024 ** 3, 1024 ** 3, 48 * 1024 ** 3)).toBe(true);
    });

    it("does not admit new work into the extension margin", () => {
        expect(canAdmitSharedReservation(48 * 1024 ** 3, 1, 48 * 1024 ** 3)).toBe(false);
    });

    it("allows a valid active extension only until the 50 GiB maximum", () => {
        expect(canExtendSharedReservation(49 * 1024 ** 3, 1024 ** 3, 50 * 1024 ** 3)).toBe(true);
        expect(canExtendSharedReservation(50 * 1024 ** 3, 1, 50 * 1024 ** 3)).toBe(false);
    });

    it("serializes simultaneous reservations without overbooking the 48 GiB new-work threshold", async () => {
        const now = Date.now() + 60_000;
        const results = await Promise.allSettled(Array.from({ length: 10 }, (_, index) => reserveSharedCapacity({ id: `load-${index}`, ownerId: `device-${index}`, kind: "terminal", reservedBytes: 5 * 1024 ** 3, expiresAt: now })));
        expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(9);
        expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
        expect((await sharedCapacitySummary()).reservedBytes).toBe(45 * 1024 ** 3);
        const reservations = await listSharedCapacityReservations();
        await Promise.all(reservations.map(async (reservation) => {
            await beginSharedCapacityRelease(reservation.id, reservation.ownerId);
            await completeSharedCapacityRelease(reservation.id, reservation.ownerId);
        }));
        expect((await sharedCapacitySummary()).reservedBytes).toBe(0);
    });

    it("reconciles an owned full-workplace reservation through the extension margin and releases unused space", async () => {
        const now = Date.now() + 60_000;
        await reserveSharedCapacity({ id: "workspace-user", ownerId: "workspace-user", kind: "workplace", reservedBytes: 1024 ** 2, expiresAt: now });
        await reserveSharedCapacity({ id: "existing-work", ownerId: "existing-user", kind: "workplace", reservedBytes: 47 * 1024 ** 3, expiresAt: now });
        await reconcileSharedCapacity("workspace-user", "workspace-user", 3 * 1024 ** 3, 1536 * 1024 ** 2);
        expect((await listSharedCapacityReservations("workspace-user"))[0]).toMatchObject({ reservedBytes: 3 * 1024 ** 3, actualBytes: 1536 * 1024 ** 2 });
        await reconcileSharedCapacity("workspace-user", "workspace-user", 512 * 1024 ** 2, 256 * 1024 ** 2);
        expect((await listSharedCapacityReservations("workspace-user"))[0]).toMatchObject({ reservedBytes: 512 * 1024 ** 2, actualBytes: 256 * 1024 ** 2 });
    });

    it("rejects a full-workplace growth request above the shared maximum", async () => {
        const now = Date.now() + 60_000;
        await reserveSharedCapacity({ id: "workspace-user", ownerId: "workspace-user", kind: "workplace", reservedBytes: 1024 ** 2, expiresAt: now });
        await expect(reconcileSharedCapacity("workspace-user", "workspace-user", 51 * 1024 ** 3)).rejects.toThrow("shared server workplace capacity is busy");
    });
});

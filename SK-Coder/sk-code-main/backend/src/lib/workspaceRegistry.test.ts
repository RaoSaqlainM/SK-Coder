import { afterEach, describe, expect, it, vi } from "vitest";
import { cancelWorkspaceDelete, createWorkspaceRecord, listExpiredWorkspaceRecords, resetWorkspaceRegistryForTest, scheduleWorkspaceDelete, setWorkspaceRetention } from "./workspaceRegistry.js";

describe("workspace retention", () => {
    afterEach(async () => {
        vi.useRealTimers();
        await resetWorkspaceRegistryForTest();
    });

    it("keeps unattended work for exactly three days before expiry", async () => {
        vi.useFakeTimers();
        const now = new Date("2026-08-27T00:00:00.000Z");
        vi.setSystemTime(now);
        const record = await createWorkspaceRecord("three-day", 1024, "three-days");
        expect(record.expiresAt - now.getTime()).toBe(72 * 60 * 60 * 1000);
        vi.setSystemTime(new Date(now.getTime() + 72 * 60 * 60 * 1000 - 1));
        expect(await listExpiredWorkspaceRecords()).toHaveLength(0);
        vi.setSystemTime(new Date(now.getTime() + 72 * 60 * 60 * 1000));
        expect((await listExpiredWorkspaceRecords()).map((item) => item.id)).toEqual(["three-day"]);
    });

    it("uses four hours for scheduled deletion and restores three days on cancellation", async () => {
        vi.useFakeTimers();
        const now = new Date("2026-08-27T00:00:00.000Z");
        vi.setSystemTime(now);
        await createWorkspaceRecord("scheduled", 1024, "three-days");
        const scheduled = await scheduleWorkspaceDelete("scheduled");
        expect(scheduled?.state).toBe("scheduled-delete");
        expect((scheduled?.expiresAt || 0) - now.getTime()).toBe(4 * 60 * 60 * 1000);
        const restored = await cancelWorkspaceDelete("scheduled");
        expect(restored?.state).toBe("active");
        expect((restored?.expiresAt || 0) - now.getTime()).toBe(72 * 60 * 60 * 1000);
        const shortened = await setWorkspaceRetention("scheduled", "four-hours");
        expect((shortened?.expiresAt || 0) - now.getTime()).toBe(4 * 60 * 60 * 1000);
    });
});

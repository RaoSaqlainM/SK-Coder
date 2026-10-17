import { describe, expect, it, vi } from "vitest";
import { releasePreviousGuiSession } from "./guiSessionReplacement";

describe("releasePreviousGuiSession", () => {
    it("stops the existing display session before replacement", async () => {
        const stopSession = vi.fn(async () => undefined);
        await releasePreviousGuiSession("display-1", stopSession);
        expect(stopSession).toHaveBeenCalledWith("display-1");
    });

    it("allows a replacement launch when the prior session is already unavailable", async () => {
        const stopSession = vi.fn(async () => {
            throw new Error("expired");
        });
        await expect(releasePreviousGuiSession("display-1", stopSession)).resolves.toBeUndefined();
    });

    it("does not call the backend without a prior session", async () => {
        const stopSession = vi.fn(async () => undefined);
        await releasePreviousGuiSession(undefined, stopSession);
        expect(stopSession).not.toHaveBeenCalled();
    });
});

import { describe, expect, it } from "vitest";
import { shouldClearPendingCommand } from "./terminalCommandRecovery";

describe("terminal command recovery", () => {
    it("clears a pending command as soon as the backend accepts it for execution", () => {
        expect(shouldClearPendingCommand("running", false)).toBe(true);
    });

    it("does not clear an unacknowledged pending command during recovery", () => {
        expect(shouldClearPendingCommand("live", true)).toBe(false);
        expect(shouldClearPendingCommand("checking", false)).toBe(false);
    });
});

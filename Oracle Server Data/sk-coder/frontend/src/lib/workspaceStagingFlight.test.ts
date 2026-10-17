import { describe, expect, it } from "vitest";
import { isSameWorkspaceStagingFlight } from "./workspaceStagingFlight";

describe("workspace staging flight", () => {
    it("shares staging only for the same workspace session and browser tree", () => {
        const tree = [];
        expect(isSameWorkspaceStagingFlight({ sessionId: "one", tree }, "one", tree)).toBe(true);
        expect(isSameWorkspaceStagingFlight({ sessionId: "one", tree }, "two", tree)).toBe(false);
        expect(isSameWorkspaceStagingFlight({ sessionId: "one", tree }, "one", [])).toBe(false);
    });
});

import { describe, expect, it } from "vitest";
import { operationCanFinalize, operationNeedsRecovery, type RuntimeOperation } from "./operationRegistry.js";

const operation: RuntimeOperation = {
    id: "runner:job-1",
    ownerId: "workspace-1",
    kind: "runner",
    resources: ["container:runner-1", "path:run-1"],
    createdAt: 1,
    expiresAt: 2,
    reservationBytes: 1024,
    state: "active",
    cleanupError: null,
};

describe("runtime operation ownership", () => {
    it("allows finalization only for the exact owner and operation kind", () => {
        expect(operationCanFinalize(operation, "workspace-1", "runner")).toBe(true);
        expect(operationCanFinalize(operation, "workspace-2", "runner")).toBe(false);
        expect(operationCanFinalize(operation, "workspace-1", "terminal")).toBe(false);
    });

    it("never finalizes an operation already finalized", () => {
        expect(operationCanFinalize({ ...operation, state: "finalized" }, "workspace-1", "runner")).toBe(false);
    });

    it("selects only expired non-terminal unfinished operations for restart recovery", () => {
        expect(operationNeedsRecovery({ ...operation, expiresAt: 2 }, 3)).toBe(true);
        expect(operationNeedsRecovery({ ...operation, kind: "terminal", expiresAt: 2 }, 3)).toBe(false);
        expect(operationNeedsRecovery({ ...operation, state: "finalized", expiresAt: 2 }, 3)).toBe(false);
        expect(operationNeedsRecovery({ ...operation, expiresAt: 4 }, 3)).toBe(false);
    });
});

import { describe, expect, it } from "vitest";
import { needsWorkspaceStage, planWorkspaceDelta, workspaceTreeRevision } from "./workspaceConnection";

describe("workspace connection staging", () => {
    it("does not restage equivalent browser source after rehydration", () => {
        const first = [{ id: "readme", name: "README.md", type: "file" as const, path: "/README.md", content: "same" }];
        const restored = [{ id: "readme", name: "README.md", type: "file" as const, path: "/README.md", content: "same" }];
        expect(needsWorkspaceStage(workspaceTreeRevision(first), workspaceTreeRevision(restored))).toBe(false);
    });

    it("restages when browser source changes", () => {
        const first = [{ id: "readme", name: "README.md", type: "file" as const, path: "/README.md", content: "before" }];
        const changed = [{ id: "readme", name: "README.md", type: "file" as const, path: "/README.md", content: "after" }];
        expect(needsWorkspaceStage(workspaceTreeRevision(first), workspaceTreeRevision(changed))).toBe(true);
    });

    it("stages only changed paths and reports deleted server paths", () => {
        const plan = planWorkspaceDelta([
            { path: "same.txt", size: 4, sha256: "same" },
            { path: "next.txt", size: 4, sha256: "next" },
        ], [
            { path: "same.txt", size: 4, sha256: "same" },
            { path: "gone.txt", size: 4, sha256: "gone" },
        ]);
        expect(plan.changed.map((entry) => entry.path)).toEqual(["next.txt"]);
        expect(plan.deletedPaths).toEqual(["gone.txt"]);
    });
});

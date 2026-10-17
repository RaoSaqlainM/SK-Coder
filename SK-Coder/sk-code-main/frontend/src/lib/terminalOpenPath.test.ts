import { describe, expect, it } from "vitest";
import { workspaceDirectoryCommand } from "./terminalOpenPath";

describe("workspaceDirectoryCommand", () => {
    it("opens a root-level file in the real workspace root", () => {
        expect(workspaceDirectoryCommand("/index.html")).toBe("cd '/workspace'");
    });

    it("opens nested files and folders through a safely quoted workspace path", () => {
        expect(workspaceDirectoryCommand("/projects/hello/main.ts")).toBe("cd '/workspace/projects/hello'");
        expect(workspaceDirectoryCommand("/projects/team's demo", true)).toBe("cd '/workspace/projects/team\"'\"'s demo'");
    });
});

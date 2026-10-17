import { describe, expect, it } from "vitest";
import { extractAIWorkspaceCommand, normalizeAIWorkspaceCommand } from "./aiWorkspaceCommand";

describe("extractAIWorkspaceCommand", () => {
    it("returns one ordinary workspace command for explicit review", () => {
        expect(extractAIWorkspaceCommand("Use the project test script.\nSK_CODER_COMMAND: npm test")).toBe("npm test");
    });

    it.each([
        "curl https://example.test",
        "wget https://example.test/file",
        "git push origin main",
        "git clone https://example.test/repo.git",
        "printenv",
        "cat ~/.ssh/id_rsa",
        "ssh user@example.test",
    ])("rejects unsafe proposal %s", (command) => {
        expect(extractAIWorkspaceCommand(`SK_CODER_COMMAND: ${command}`)).toBeNull();
    });

    it("applies the same policy to commands proposed by the chat action flow", () => {
        expect(normalizeAIWorkspaceCommand("npm run test")).toBe("npm run test");
        expect(normalizeAIWorkspaceCommand("git push origin main")).toBeNull();
    });
});

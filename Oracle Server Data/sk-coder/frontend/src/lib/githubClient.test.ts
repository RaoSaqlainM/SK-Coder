import { describe, expect, it, vi } from "vitest";

vi.mock("./browserStorage", () => ({
    loadBrowserBlob: vi.fn(),
}));

import { loadBrowserBlob } from "./browserStorage";
import { encodeGitHubFileContent } from "./githubClient";

describe("encodeGitHubFileContent", () => {
    it("encodes browser-stored binary data when the local blob is present", async () => {
        vi.mocked(loadBrowserBlob).mockResolvedValue(new Blob([new Uint8Array([0, 255, 1])]));
        await expect(encodeGitHubFileContent({ assetBlobId: "blob-1" })).resolves.toEqual({ content: "AP8B" });
    });

    it("reports a truthful skip reason when a browser blob is unavailable", async () => {
        vi.mocked(loadBrowserBlob).mockResolvedValue(null);
        await expect(encodeGitHubFileContent({ assetBlobId: "missing" })).resolves.toEqual({ reason: "The browser copy of this file is no longer available" });
    });

    it("preserves existing inline source encoding", async () => {
        await expect(encodeGitHubFileContent({ content: "console.log('ok')" })).resolves.toEqual({ content: "Y29uc29sZS5sb2coJ29rJyk=" });
    });
});

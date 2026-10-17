import { describe, expect, it, vi } from "vitest";

vi.mock("./browserStorage", () => ({
    loadBrowserBlob: vi.fn(),
}));

import { loadBrowserBlob } from "./browserStorage";
import { collectWholeWorkspaceSources } from "./wholeWorkspaceMirror";

describe("whole workplace mirror", () => {
    it("collects inline source and persistent binary files with their exact workspace paths", async () => {
        vi.mocked(loadBrowserBlob).mockResolvedValue(new Blob([new Uint8Array([0, 255, 1])], { type: "application/octet-stream" }));
        const sources = await collectWholeWorkspaceSources([
            { id: "source", name: "main.ts", type: "file", path: "/main.ts", content: "console.log('oracle')" },
            { id: "assets", name: "assets", type: "folder", path: "/assets", children: [
                { id: "image", name: "logo.bin", type: "file", path: "/assets/logo.bin", assetBlobId: "opfs:logo", assetSize: 3 },
            ] },
        ]);
        expect(sources.map((source) => source.path)).toEqual(["main.ts", "assets/logo.bin"]);
        expect(await sources[0].blob.text()).toBe("console.log('oracle')");
        expect([...new Uint8Array(await sources[1].blob.arrayBuffer())]).toEqual([0, 255, 1]);
    });

    it("stops staging when a persistent browser import is no longer available", async () => {
        vi.mocked(loadBrowserBlob).mockResolvedValue(null);
        await expect(collectWholeWorkspaceSources([
            { id: "archive", name: "project.zip", type: "file", path: "/project.zip", assetBlobId: "opfs:missing", assetSize: 1 },
        ])).rejects.toThrow("project.zip is no longer available");
    });
});

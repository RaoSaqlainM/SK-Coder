import JSZip from "jszip";
import { describe, expect, it, vi } from "vitest";
import { exportToZip, importFromFiles, importSmartFiles, isZipCompatibleArchive, type ProjectTransferProgress } from "./importProject";
import * as browserStorage from "./browserStorage";

describe("importSmartFiles", () => {
    it("adds only the extracted folder for a successfully imported ZIP archive", async () => {
        const zip = new JSZip();
        zip.file("src/main.js", "console.log('archive import passed')");
        const blob = await zip.generateAsync({ type: "blob" });
        const archive = new File([blob], "sample.zip", { type: "application/zip" });
        const result = await importSmartFiles([archive]);
        expect(result.errors).toEqual([]);
        expect(result.extractedCount).toBe(1);
        expect(result.nodes).toHaveLength(1);
        expect(result.nodes[0]).toMatchObject({ name: "sample", type: "folder", path: "/sample" });
        expect(result.nodes[0].children?.[0]).toMatchObject({ name: "src", type: "folder" });
    });

    it("keeps ZIP-compatible archive families eligible for browser extraction", () => {
        expect(isZipCompatibleArchive("project.zip")).toBe(true);
        expect(isZipCompatibleArchive("library.jar")).toBe(true);
        expect(isZipCompatibleArchive("application.apk")).toBe(true);
        expect(isZipCompatibleArchive("bundle.apks")).toBe(true);
        expect(isZipCompatibleArchive("archive.tar.gz")).toBe(false);
    });

    it("keeps oversized source as a browser asset instead of importing an empty editor file", async () => {
        const store = vi.spyOn(browserStorage, "storeBrowserBlob").mockResolvedValue("large-source-blob");
        const file = new File([new Uint8Array(9 * 1024 * 1024)], "large.js", { type: "text/javascript" });
        const nodes = await importFromFiles([file]);
        expect(nodes[0]).toMatchObject({ name: "large.js", assetBlobId: "large-source-blob", assetSize: file.size });
        expect(nodes[0].content).toBeUndefined();
        store.mockRestore();
    });

    it("reports real source-file import completion without inventing byte progress", async () => {
        const progress: ProjectTransferProgress[] = [];
        const result = await importSmartFiles([
            new File(["first"], "first.txt", { type: "text/plain" }),
            new File(["second"], "second.txt", { type: "text/plain" }),
        ], (event) => progress.push(event));
        expect(result.regularCount).toBe(2);
        expect(progress.at(-1)).toMatchObject({ stage: "Files processed", completed: 2, total: 2, current: "second.txt" });
    });

    it("reports packaging progress from actual files before a ZIP export", async () => {
        const progress: ProjectTransferProgress[] = [];
        const blob = await exportToZip([
            { id: "1", type: "file", name: "one.txt", path: "/one.txt", content: "one" },
            { id: "2", type: "file", name: "two.txt", path: "/two.txt", content: "two" },
        ], (event) => progress.push(event));
        expect(blob.size).toBeGreaterThan(0);
        expect(progress).toContainEqual({ stage: "Packaging file", completed: 2, total: 2, current: "two.txt" });
        expect(progress.at(-1)).toMatchObject({ stage: "Export ready", completed: 2, total: 2 });
    });
});

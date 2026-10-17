import { describe, expect, it } from "vitest";
import { isBrowserAssetOnly } from "./browserAsset";

describe("isBrowserAssetOnly", () => {
    it("recognizes a browser-stored source asset without inline editor content", () => {
        expect(isBrowserAssetOnly({ assetBlobId: "blob-1", content: undefined })).toBe(true);
    });

    it("does not hide editable inline source", () => {
        expect(isBrowserAssetOnly({ assetBlobId: "blob-1", content: "console.log(1)" })).toBe(false);
    });
});

import { describe, expect, it } from "vitest";
import { browserBlobStorageTarget } from "./browserStorage";

describe("browser blob storage keys", () => {
    it("routes new OPFS and IndexedDB keys without losing legacy IndexedDB entries", () => {
        expect(browserBlobStorageTarget("opfs:file-1")).toEqual({ backend: "opfs", id: "file-1" });
        expect(browserBlobStorageTarget("idb:file-2")).toEqual({ backend: "idb", id: "file-2" });
        expect(browserBlobStorageTarget("legacy-file-3")).toEqual({ backend: "idb", id: "legacy-file-3" });
    });
});

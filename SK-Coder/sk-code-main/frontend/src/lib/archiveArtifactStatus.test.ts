import { describe, expect, it } from "vitest";
import { getArchiveArtifactStatus } from "./archiveArtifactStatus";

describe("getArchiveArtifactStatus", () => {
    it("labels a modified APK as unsigned rather than installable", () => {
        const status = getArchiveArtifactStatus("sample.apk", 2);
        expect(status.downloadName).toBe("sample_modified_unsigned.apk");
        expect(status.signature).toContain("invalidate");
        expect(status.readiness).toContain("not been verified");
    });

    it("does not present an unchanged APK repackage as signature-valid", () => {
        const status = getArchiveArtifactStatus("sample.apk", 0);
        expect(status.readiness).toContain("Repackaged archive only");
        expect(status.signature).toContain("invalidates");
    });

    it("preserves a ZIP archive extension", () => {
        expect(getArchiveArtifactStatus("assets.zip", 1).downloadName).toBe("assets_modified.zip");
    });

    it("preserves XAPK and APKS package extensions", () => {
        expect(getArchiveArtifactStatus("bundle.xapk", 1).downloadName).toBe("bundle_modified.xapk");
        expect(getArchiveArtifactStatus("splits.apks", 1).downloadName).toBe("splits_modified.apks");
    });

    it("uses a ZIP-safe filename when the source has no archive extension", () => {
        expect(getArchiveArtifactStatus("download", 0).downloadName).toBe("download_modified.zip");
    });
});

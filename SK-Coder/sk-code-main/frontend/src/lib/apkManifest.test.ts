import { describe, expect, it } from "vitest";
import { readApkManifestMetadata, updateApkManifestMetadata } from "./apkManifest";

const manifest = `<manifest package="com.example.old" android:versionCode="1" android:versionName="1.0"><uses-sdk android:minSdkVersion="24" android:targetSdkVersion="35"/><application android:label="Old name" android:icon="@mipmap/ic_launcher"/></manifest>`;

describe("APK manifest metadata", () => {
    it("reads editable decoded manifest metadata", () => {
        expect(readApkManifestMetadata(manifest)).toMatchObject({ packageName: "com.example.old", appLabel: "Old name", appIcon: "@mipmap/ic_launcher", versionCode: "1", versionName: "1.0", minSdkVersion: "24", targetSdkVersion: "35", installLocation: "auto" });
    });

    it("updates manifest, application, and uses-sdk attributes without changing unrelated XML", () => {
        let result = updateApkManifestMetadata(manifest, "packageName", "com.example.new");
        result = updateApkManifestMetadata(result, "appLabel", "New name");
        result = updateApkManifestMetadata(result, "appIcon", "@mipmap/new_icon");
        result = updateApkManifestMetadata(result, "installLocation", "preferExternal");
        result = updateApkManifestMetadata(result, "minSdkVersion", "26");
        result = updateApkManifestMetadata(result, "targetSdkVersion", "36");
        expect(readApkManifestMetadata(result)).toMatchObject({ packageName: "com.example.new", appLabel: "New name", appIcon: "@mipmap/new_icon", installLocation: "preferExternal", minSdkVersion: "26", targetSdkVersion: "36" });
        expect(result).toContain("android:versionName=\"1.0\"");
    });
});

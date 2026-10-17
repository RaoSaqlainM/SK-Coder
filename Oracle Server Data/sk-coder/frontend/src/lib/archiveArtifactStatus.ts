export type ArchiveArtifactStatus = {
    downloadName: string;
    readiness: string;
    signature: string;
};

const archiveExtension = /\.(apk|zip|xapk|apks)$/i;

export function getArchiveArtifactStatus(sourceName: string, changedEntryCount: number): ArchiveArtifactStatus {
    const matchedExtension = sourceName.match(archiveExtension)?.[0]?.toLowerCase() || ".zip";
    const baseName = sourceName.replace(archiveExtension, "") || "package";
    const changed = changedEntryCount > 0;
    if (matchedExtension === ".apk") {
        return {
            downloadName: `${baseName}_modified_unsigned.apk`,
            readiness: changed ? "Modified archive only; installation has not been verified." : "Repackaged archive only; installation has not been verified.",
            signature: "Local repackaging invalidates the original APK signature.",
        };
    }
    return {
        downloadName: `${baseName}_modified${matchedExtension}`,
        readiness: "Local archive export; installation validation does not apply.",
        signature: "Not an APK signature artifact.",
    };
}

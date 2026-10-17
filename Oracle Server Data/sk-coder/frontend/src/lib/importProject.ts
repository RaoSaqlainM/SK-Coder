import type { FileNode } from "../types/ide";
import { loadBrowserBlob, storeBrowserBlob } from "./browserStorage";
async function loadZipLibrary() {
    const module = await import("jszip");
    return (module.default ?? module) as typeof module.default;
}
function generateId() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
function getLanguage(filename: string): string {
    const ext = filename.split(".").pop()?.toLowerCase() || "";
    const map: Record<string, string> = {
        ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
        py: "python", cpp: "cpp", c: "c", h: "cpp", html: "html", htm: "html",
        css: "css", scss: "scss", json: "json", yaml: "yaml", yml: "yaml",
        xml: "xml", md: "markdown", sh: "shell", java: "java", kt: "kotlin",
        rs: "rust", go: "go", rb: "ruby", php: "php", swift: "swift",
        dart: "dart", sql: "sql", r: "r", txt: "plaintext",
        env: "plaintext", toml: "toml", ini: "ini",
    };
    return map[ext] || "plaintext";
}
const SKIP_ENTRIES = new Set([
    "__MACOSX", ".DS_Store", "Thumbs.db", ".git",
    "node_modules", ".next", "dist", "build", ".cache", ".venv",
]);
const ZIP_COMPATIBLE_ARCHIVE_EXTENSIONS = new Set([
    "zip", "jar", "apk", "xapk", "apks", "war", "ear", "aar",
]);
const ARCHIVE_CANDIDATE_EXTENSIONS = new Set([
    ...ZIP_COMPATIBLE_ARCHIVE_EXTENSIONS,
    "7z", "rar", "tar", "gz", "tgz", "bz2", "tbz", "tbz2", "xz", "txz", "zst", "cab", "iso",
]);
const MAX_ARCHIVE_BYTES = 1024 * 1024 * 1024;
const MAX_ARCHIVE_ENTRIES = 10000;
const INLINE_TEXT_BYTES = 8 * 1024 * 1024;
const IMPORT_BATCH_SIZE = 4;
function yieldToBrowser(): Promise<void> {
    return new Promise((resolve) => window.setTimeout(resolve, 0));
}
export type ProjectTransferProgress = {
    stage: string;
    completed: number;
    total: number;
    current?: string;
};
const PREVIEWABLE_ASSET_MIME_TYPES: Record<string, string> = {
    png: "image/png", apng: "image/apng", jpg: "image/jpeg", jpeg: "image/jpeg", jpe: "image/jpeg", jfif: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml", svgz: "image/svg+xml", bmp: "image/bmp", ico: "image/x-icon", cur: "image/x-icon", avif: "image/avif", tif: "image/tiff", tiff: "image/tiff", heic: "image/heic", heif: "image/heif", jxl: "image/jxl",
    mp4: "video/mp4", m4v: "video/x-m4v", webm: "video/webm", ogv: "video/ogg", mov: "video/quicktime", mkv: "video/x-matroska", avi: "video/x-msvideo", wmv: "video/x-ms-wmv", flv: "video/x-flv", mpeg: "video/mpeg", mpg: "video/mpeg", "3gp": "video/3gpp", "3g2": "video/3gpp2", ts: "video/mp2t", mts: "video/mp2t", m2ts: "video/mp2t",
    mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg", oga: "audio/ogg", opus: "audio/ogg", m4a: "audio/mp4", aac: "audio/aac", flac: "audio/flac", wma: "audio/x-ms-wma", aif: "audio/aiff", aiff: "audio/aiff", amr: "audio/amr",
    pdf: "application/pdf",
};
function shouldSkip(name: string): boolean {
    return SKIP_ENTRIES.has(name) || name.startsWith(".");
}
function previewableAssetMimeType(name: string, browserMimeType = ""): string | null {
    const normalizedBrowserMime = browserMimeType.split(";", 1)[0].trim().toLowerCase();
    if (/^(image|video|audio)\//.test(normalizedBrowserMime) || normalizedBrowserMime === "application/pdf")
        return normalizedBrowserMime;
    const extension = name.split(".").pop()?.toLowerCase() || "";
    return PREVIEWABLE_ASSET_MIME_TYPES[extension] || null;
}
async function nodeForBrowserFile(file: File, path: string): Promise<FileNode> {
    if (isArchiveCandidate(file.name)) {
        const assetBlobId = await storeBrowserBlob(file);
        return { id: generateId(), name: file.name, type: "file", path, language: getLanguage(file.name), assetBlobId, assetMimeType: isZipCompatibleArchive(file.name) ? "application/zip" : "application/x-sk-coder-archive", assetSize: file.size };
    }
    const mimeType = previewableAssetMimeType(file.name, file.type);
    if (mimeType) {
        const assetBlobId = await storeBrowserBlob(file);
        return { id: generateId(), name: file.name, type: "file", path, language: getLanguage(file.name), assetBlobId, assetMimeType: mimeType, assetSize: file.size };
    }
    if (file.size > INLINE_TEXT_BYTES) {
        const assetBlobId = await storeBrowserBlob(file);
        return { id: generateId(), name: file.name, type: "file", path, language: getLanguage(file.name), assetBlobId, assetMimeType: file.type || "application/octet-stream", assetSize: file.size };
    }
    return { id: generateId(), name: file.name, type: "file", path, language: getLanguage(file.name), content: await file.text(), assetSize: file.size };
}
function archiveRootName(filename: string): string {
    return filename.replace(/\.(zip|jar|apk|xapk|apks|war|ear|aar)$/i, "") || "archive";
}
function rebaseArchiveNodes(nodes: FileNode[], rootName: string): FileNode {
    const rootPath = `/${rootName}`;
    function rebase(node: FileNode, parentPath: string): FileNode {
        const path = `${parentPath}/${node.name}`;
        return {
            ...node,
            id: generateId(),
            path,
            children: node.children?.map((child) => rebase(child, path)),
        };
    }
    return {
        id: generateId(),
        name: rootName,
        type: "folder",
        path: rootPath,
        children: nodes.map((node) => rebase(node, rootPath)),
    };
}
export function isZipCompatibleArchive(filename: string): boolean {
    const extension = filename.split(".").pop()?.toLowerCase() || "";
    return ZIP_COMPATIBLE_ARCHIVE_EXTENSIONS.has(extension);
}
export function isArchiveCandidate(filename: string): boolean {
    const normalized = filename.toLowerCase();
    if (normalized.endsWith(".tar.gz") || normalized.endsWith(".tar.bz2") || normalized.endsWith(".tar.xz"))
        return true;
    const extension = normalized.split(".").pop() || "";
    return ARCHIVE_CANDIDATE_EXTENSIONS.has(extension);
}
export async function isZipCompatibleFile(file: File): Promise<boolean> {
    if (isZipCompatibleArchive(file.name))
        return true;
    if (file.size < 4)
        return false;
    const header = new Uint8Array(await file.slice(0, 4).arrayBuffer());
    return header[0] === 0x50 && header[1] === 0x4b && (header[2] === 0x03 || header[2] === 0x05 || header[2] === 0x07) && (header[3] === 0x04 || header[3] === 0x06 || header[3] === 0x08);
}
export async function importFromArchive(file: File): Promise<FileNode[]> {
    if (!await isZipCompatibleFile(file)) {
        throw new Error("This archive format is not supported for browser extraction");
    }
    if (file.size > MAX_ARCHIVE_BYTES) {
        throw new Error("Archive is larger than the 1 GB browser extraction target");
    }
    const nodes = await importFromZip(file);
    return [rebaseArchiveNodes(nodes, archiveRootName(file.name))];
}
export async function importFromZip(file: File): Promise<FileNode[]> {
    try {
        const JSZip = await loadZipLibrary();
        const zip = await JSZip.loadAsync(await file.arrayBuffer());
        const sortedPaths = Object.keys(zip.files).sort();
        if (sortedPaths.length > MAX_ARCHIVE_ENTRIES) {
            throw new Error("Archive contains too many entries for browser extraction");
        }
        const pathMap = new Map<string, FileNode>();
        const roots: FileNode[] = [];
        for (const relativePath of sortedPaths) {
            const zipFile = zip.files[relativePath];
            const parts = relativePath.split("/").filter(Boolean);
            if (parts.length === 0)
                continue;
            if (parts.some(shouldSkip))
                continue;
            let parentNode: FileNode | null = null;
            let currentPath = "";
            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                const isLast = i === parts.length - 1;
                const childPath = currentPath ? `${currentPath}/${part}` : `/${part}`;
                if (!pathMap.has(childPath)) {
                    const isFile = isLast && !zipFile.dir;
                    const newNode: FileNode = {
                        id: generateId(),
                        name: part,
                        type: isFile ? "file" : "folder",
                        path: childPath,
                        language: isFile ? getLanguage(part) : undefined,
                        children: isFile ? undefined : [],
                    };
                    if (isFile) {
                        try {
                            const blob = await zipFile.async("blob");
                            const mimeType = previewableAssetMimeType(part, blob.type);
                            if (isZipCompatibleArchive(part)) {
                                newNode.assetBlobId = await storeBrowserBlob(blob);
                                newNode.assetMimeType = "application/zip";
                                newNode.assetSize = blob.size;
                            }
                            else if (mimeType) {
                                newNode.assetBlobId = await storeBrowserBlob(blob);
                                newNode.assetMimeType = mimeType;
                                newNode.assetSize = blob.size;
                            }
                            else if (blob.size <= INLINE_TEXT_BYTES) {
                                newNode.content = await blob.text();
                                newNode.assetSize = blob.size;
                            }
                            else {
                                throw new Error("Large non-previewable archive entries cannot be opened as editable source");
                            }
                        }
                        catch (err) {
                            console.error(`Failed to read ${relativePath}:`, err);
                            newNode.content = "";
                        }
                    }
                    pathMap.set(childPath, newNode);
                    if (parentNode) {
                        if (!parentNode.children)
                            parentNode.children = [];
                        parentNode.children.push(newNode);
                    }
                    else {
                        roots.push(newNode);
                    }
                }
                parentNode = pathMap.get(childPath)!;
                currentPath = childPath;
            }
        }
        return roots;
    }
    catch (err) {
        console.error("ZIP import error:", err);
        throw new Error(`Failed to import ZIP: ${err instanceof Error ? err.message : String(err)}`);
    }
}
export async function importFromFiles(files: Iterable<File>, onProgress?: (progress: ProjectTransferProgress) => void): Promise<FileNode[]> {
    const sourceFiles = Array.from(files);
    const hasStructure = sourceFiles.some((f) => ((f as File & {
        webkitRelativePath?: string;
    }).webkitRelativePath || "").includes("/"));
    if (!hasStructure) {
        const nodes: FileNode[] = [];
        const accepted = sourceFiles.filter((file) => !shouldSkip(file.name));
        for (let start = 0; start < accepted.length; start += IMPORT_BATCH_SIZE) {
            const batch = accepted.slice(start, start + IMPORT_BATCH_SIZE);
            try {
                const created = await Promise.all(batch.map((file) => nodeForBrowserFile(file, `/${file.name}`)));
                nodes.push(...created);
                const completed = start + created.length;
                onProgress?.({ stage: "Adding files", completed, total: accepted.length, current: batch.at(-1)?.name });
                if (completed < accepted.length)
                    await yieldToBrowser();
            }
            catch (error) {
                throw error instanceof Error ? error : new Error("Could not import selected files");
            }
        }
        return nodes;
    }
    const pathMap = new Map<string, FileNode>();
    const roots: FileNode[] = [];
    for (const [fileIndex, file] of sourceFiles.entries()) {
        const relativePath = (file as File & {
            webkitRelativePath?: string;
        }).webkitRelativePath || file.name;
        const parts = relativePath.split("/").filter(Boolean);
        if (parts.some(shouldSkip))
            continue;
        let parentNode: FileNode | null = null;
        let currentPath = "";
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const isLast = i === parts.length - 1;
            const childPath = currentPath ? `${currentPath}/${part}` : `/${part}`;
            if (!pathMap.has(childPath)) {
                const isFile = isLast;
                const newNode: FileNode = {
                    id: generateId(),
                    name: part,
                    type: isFile ? "file" : "folder",
                    path: childPath,
                    language: isFile ? getLanguage(part) : undefined,
                    children: isFile ? undefined : [],
                };
                if (isFile) {
                    try {
                        const importedNode = await nodeForBrowserFile(file, childPath);
                        newNode.content = importedNode.content;
                        newNode.assetBlobId = importedNode.assetBlobId;
                        newNode.assetMimeType = importedNode.assetMimeType;
                        newNode.assetSize = importedNode.assetSize;
                        onProgress?.({ stage: "Adding files", completed: fileIndex + 1, total: sourceFiles.length, current: file.name });
                    }
                    catch {
                        newNode.content = "";
                    }
                }
                pathMap.set(childPath, newNode);
                if (parentNode) {
                    if (!parentNode.children)
                        parentNode.children = [];
                    parentNode.children.push(newNode);
                }
                else {
                    roots.push(newNode);
                }
            }
            parentNode = pathMap.get(childPath)!;
            currentPath = childPath;
        }
    }
    return roots;
}
export type SmartImportResult = {
    nodes: FileNode[];
    regularCount: number;
    extractedCount: number;
    errors: string[];
};
export async function importSmartFiles(files: Iterable<File>, onProgress?: (progress: ProjectTransferProgress) => void): Promise<SmartImportResult> {
    const selectedFiles = Array.from(files);
    const total = selectedFiles.length;
    let completed = 0;
    const archiveFlags = await Promise.all(selectedFiles.map((file) => isZipCompatibleFile(file).catch(() => false)));
    const archives = selectedFiles.filter((_, index) => archiveFlags[index]);
    const regularFiles = selectedFiles.filter((_, index) => !archiveFlags[index]);
    const nodes: FileNode[] = [];
    const errors: string[] = [];
    let extractedCount = 0;
    for (const archive of archives) {
        onProgress?.({ stage: "Extracting archive", completed, total, current: archive.name });
        try {
            nodes.push(...await importFromArchive(archive));
            extractedCount++;
        }
        catch (error) {
            nodes.push(...await importFromFiles([archive]));
            errors.push(`${archive.name}: ${error instanceof Error ? error.message : "could not be extracted"}`);
        }
        completed++;
        onProgress?.({ stage: "Archive processed", completed, total, current: archive.name });
    }
    if (regularFiles.length) {
        onProgress?.({ stage: "Adding files", completed, total, current: regularFiles[0]?.name });
        try {
            nodes.push(...await importFromFiles(regularFiles, (event) => onProgress?.({ ...event, completed: completed + event.completed, total })));
        }
        catch (error) {
            errors.push(error instanceof Error ? error.message : "Some selected files could not be imported");
        }
        completed += regularFiles.length;
        onProgress?.({ stage: "Files processed", completed, total, current: regularFiles.at(-1)?.name });
    }
    return { nodes, regularCount: regularFiles.length, extractedCount, errors };
}
function countExportFiles(nodes: FileNode[]): number {
    return nodes.reduce((total, node) => total + (node.type === "file" ? 1 : countExportFiles(node.children || [])), 0);
}
export async function exportToZip(nodes: FileNode[], onProgress?: (progress: ProjectTransferProgress) => void): Promise<Blob> {
    const JSZip = await loadZipLibrary();
    const zip = new JSZip();
    const total = countExportFiles(nodes);
    let completed = 0;
    onProgress?.({ stage: "Collecting project files", completed, total });
    async function addToZip(node: FileNode, prefix = ""): Promise<void> {
        if (node.type === "file") {
            const assetData = node.assetData;
            if (assetData?.startsWith("data:")) {
                zip.file(prefix + node.name, assetData.slice(assetData.indexOf(",") + 1), { base64: true });
            }
            else if (node.assetBlobId) {
                const blob = await loadBrowserBlob(node.assetBlobId);
                if (!blob)
                    throw new Error(`${node.name} is no longer available in browser storage`);
                zip.file(prefix + node.name, blob);
            }
            else {
                zip.file(prefix + node.name, node.content || "");
            }
            completed++;
            onProgress?.({ stage: "Packaging file", completed, total, current: prefix + node.name });
        }
        else {
            const folderPath = prefix + node.name + "/";
            for (const child of node.children || []) {
                await addToZip(child, folderPath);
            }
        }
    }
    for (const node of nodes) {
        await addToZip(node);
    }
    onProgress?.({ stage: "Compressing archive", completed, total });
    const result = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
    onProgress?.({ stage: "Export ready", completed, total });
    return result;
}
export function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

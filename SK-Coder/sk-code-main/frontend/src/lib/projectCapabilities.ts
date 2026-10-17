import type { FileNode } from "@/types/ide";
export type FileCapability = "preview" | "run" | "none";
export type MediaKind = "image" | "video" | "audio";
export type PreviewKind = MediaKind | "pdf";
export type FolderCapability = {
    buildCommand?: string;
    runCommand?: string;
    label?: string;
};
const SOURCE_EXTENSIONS = new Set([
    "js", "mjs", "cjs", "ts", "tsx", "py", "java", "kt", "kts", "cs", "c", "cc", "cpp", "cxx", "rs", "go", "php", "rb", "sh", "bash",
]);
const HTML_EXTENSIONS = new Set(["html", "htm"]);
const TEXT_PREVIEW_EXTENSIONS = new Set(["css", "md", "markdown"]);
const IMAGE_EXTENSIONS = new Set(["png", "apng", "jpg", "jpeg", "jpe", "jfif", "gif", "webp", "svg", "svgz", "bmp", "ico", "cur", "avif", "tif", "tiff", "heic", "heif", "jxl"]);
const VIDEO_EXTENSIONS = new Set(["mp4", "m4v", "webm", "ogv", "ogg", "mov", "mkv", "avi", "wmv", "flv", "mpeg", "mpg", "3gp", "3g2", "ts", "mts", "m2ts"]);
const AUDIO_EXTENSIONS = new Set(["mp3", "wav", "ogg", "oga", "opus", "webm", "m4a", "aac", "flac", "wma", "aif", "aiff", "amr", "3gp"]);
const PDF_EXTENSIONS = new Set(["pdf"]);
export function extensionFor(name: string) {
    const last = name.lastIndexOf(".");
    return last >= 0 ? name.slice(last + 1).toLowerCase() : "";
}
export function getFileCapability(node: FileNode): FileCapability {
    if (node.type !== "file")
        return "none";
    const extension = extensionFor(node.name);
    if (HTML_EXTENSIONS.has(extension) || TEXT_PREVIEW_EXTENSIONS.has(extension) || isDirectPreviewFile(node))
        return "preview";
    return SOURCE_EXTENSIONS.has(extension) ? "run" : "none";
}
export function supportsGuiDisplay(node: FileNode): boolean {
    if (node.type !== "file")
        return false;
    const extension = extensionFor(node.name);
    const source = (node.content || "").toLowerCase();
    if (extension === "py")
        return /\b(tkinter|pygame)\b/.test(source);
    if (extension === "java")
        return /\b(javax\.swing|java\.awt)\b/.test(source);
    return false;
}
export function isImagePreviewFile(node: FileNode): boolean {
    return getMediaKind(node) === "image";
}
export function isVideoPreviewFile(node: FileNode): boolean {
    return getMediaKind(node) === "video";
}
export function isAudioPreviewFile(node: FileNode): boolean {
    return getMediaKind(node) === "audio";
}
export function isDirectPreviewFile(node: FileNode): boolean {
    return getPreviewKind(node) !== null;
}
export function isPdfPreviewFile(node: FileNode): boolean {
    return getPreviewKind(node) === "pdf";
}
export function getPreviewKind(node: FileNode): PreviewKind | null {
    const mediaKind = getMediaKind(node);
    if (mediaKind)
        return mediaKind;
    if (node.type !== "file")
        return null;
    const dataMime = node.assetData?.match(/^data:([^;,]+)/i)?.[1]?.toLowerCase() || "";
    if (dataMime === "application/pdf")
        return "pdf";
    return PDF_EXTENSIONS.has(extensionFor(node.name)) ? "pdf" : null;
}
export function getMediaKind(node: FileNode): MediaKind | null {
    if (node.type !== "file")
        return null;
    const dataMime = node.assetData?.match(/^data:([^;,]+)/i)?.[1]?.toLowerCase() || "";
    if (dataMime.startsWith("image/"))
        return "image";
    if (dataMime.startsWith("video/"))
        return "video";
    if (dataMime.startsWith("audio/"))
        return "audio";
    const extension = extensionFor(node.name);
    if (IMAGE_EXTENSIONS.has(extension))
        return "image";
    if (VIDEO_EXTENSIONS.has(extension))
        return "video";
    if (AUDIO_EXTENSIONS.has(extension))
        return "audio";
    return null;
}
export function previewLabelFor(node: FileNode): string {
    void node;
    return "Preview";
}
function namesInFolder(folder: FileNode) {
    return new Set((folder.children ?? []).filter((node) => node.type === "file").map((node) => node.name.toLowerCase()));
}
export function getFolderCapability(folder: FileNode): FolderCapability {
    if (folder.type !== "folder")
        return {};
    const names = namesInFolder(folder);
    if (names.has("package.json"))
        return { label: "Node.js project", buildCommand: "npm run build", runCommand: "npm run dev" };
    if ([...names].some((name) => name.endsWith(".csproj")))
        return { label: ".NET project", buildCommand: "dotnet build", runCommand: "dotnet run" };
    if (names.has("cargo.toml"))
        return { label: "Rust project", buildCommand: "cargo build", runCommand: "cargo run" };
    if (names.has("go.mod"))
        return { label: "Go project", buildCommand: "go build ./...", runCommand: "go run ." };
    if (names.has("pom.xml"))
        return { label: "Java Maven project", buildCommand: "mvn package", runCommand: "mvn exec:java" };
    if (names.has("build.gradle") || names.has("build.gradle.kts"))
        return { label: "JVM Gradle project", buildCommand: "gradle build", runCommand: "gradle run" };
    if (names.has("cmakelists.txt"))
        return { label: "CMake project", buildCommand: "cmake -S . -B build && cmake --build build" };
    if (names.has("makefile"))
        return { label: "Make project", buildCommand: "make" };
    if (names.has("composer.json"))
        return { label: "PHP project", runCommand: "php -S 0.0.0.0:3000" };
    if (names.has("gemfile"))
        return { label: "Ruby project", runCommand: "bundle exec ruby main.rb" };
    if (names.has("requirements.txt") || names.has("pyproject.toml"))
        return { label: "Python project", runCommand: "python3 main.py" };
    return {};
}
export function folderCommand(folder: FileNode, command: string) {
    return `cd ${JSON.stringify(folder.path || "/")} && ${command}`;
}

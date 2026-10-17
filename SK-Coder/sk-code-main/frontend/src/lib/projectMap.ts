import type { FileNode } from "@/types/ide";

export type ProjectMap = {
    projectKind: string;
    totalFiles: number;
    totalFolders: number;
    generatedFiles: number;
    sensitiveFiles: number;
    languages: Array<{ name: string; count: number }>;
    manifests: string[];
    entryPoints: string[];
    tests: string[];
};

type ProjectFile = {
    path: string;
    name: string;
    language?: string;
};

const languageByExtension: Record<string, string> = {
    ts: "TypeScript", tsx: "TypeScript", js: "JavaScript", jsx: "JavaScript", mjs: "JavaScript", cjs: "JavaScript",
    py: "Python", rs: "Rust", java: "Java", kt: "Kotlin", kts: "Kotlin", c: "C", h: "C/C++", cpp: "C++", cc: "C++", cxx: "C++",
    go: "Go", php: "PHP", rb: "Ruby", sh: "Shell", bash: "Shell", zsh: "Shell", html: "HTML", htm: "HTML", css: "CSS",
    scss: "SCSS", sass: "Sass", json: "JSON", yaml: "YAML", yml: "YAML", xml: "XML", md: "Markdown", sql: "SQL", dart: "Dart",
    swift: "Swift", cs: "C#", lua: "Lua", r: "R", vue: "Vue", svelte: "Svelte",
};

const manifestNames = new Set([
    "package.json", "pnpm-lock.yaml", "package-lock.json", "yarn.lock", "bun.lockb", "pyproject.toml", "requirements.txt",
    "poetry.lock", "Cargo.toml", "go.mod", "pom.xml", "build.gradle", "build.gradle.kts", "settings.gradle", "settings.gradle.kts",
    "CMakeLists.txt", "Makefile", "Gemfile", "composer.json", "pubspec.yaml", "Podfile", "AndroidManifest.xml",
]);

const generatedSegment = /(^|\/)(?:node_modules|dist|build|coverage|\.git|\.next|\.vite|target|out|vendor|\.gradle)(?:\/|$)/i;
const sensitiveName = /(^|\/)(?:\.env(?:\..*)?|id_rsa(?:\.pub)?|credentials(?:\..*)?|secrets?(?:\..*)?|.*\.(?:pem|key|p12|pfx|keystore|jks))$/i;
const testPath = /(^|\/)(?:test|tests|__tests__|spec|specs)(?:\/|$)|(?:\.test|\.spec)\.[^/]+$/i;
const entryName = /(^|\/)(?:src\/)?(?:main|index|app|server|program|manage|wsgi|asgi)\.(?:[cm]?[jt]sx?|py|rs|java|kt|go|php|rb|c(?:pp|xx|c)?|html)$/i;

export function isSensitiveProjectPath(path: string) {
    return sensitiveName.test(path);
}

export function redactContextText(value: string) {
    return value
        .replace(/\b(api[_-]?key|access[_-]?token|auth[_-]?token|password|secret|private[_-]?key)\s*[:=]\s*[^\s,;]+/gi, "$1=[redacted]")
        .replace(/\b(?:sk-[A-Za-z0-9_-]{16,}|AIza[A-Za-z0-9_-]{16,}|ghp_[A-Za-z0-9]{20,})\b/g, "[redacted]");
}

function languageFor(file: ProjectFile) {
    if (file.language && file.language !== "plaintext") return file.language.replace(/^\w/, (value) => value.toUpperCase());
    const extension = file.name.split(".").pop()?.toLowerCase() || "";
    return languageByExtension[extension] || "Other";
}

function projectKind(manifests: string[]) {
    if (manifests.includes("Cargo.toml")) return "Rust project";
    if (manifests.includes("package.json")) return "JavaScript or TypeScript project";
    if (manifests.includes("pyproject.toml") || manifests.includes("requirements.txt")) return "Python project";
    if (manifests.includes("go.mod")) return "Go project";
    if (manifests.includes("pom.xml") || manifests.some((path) => /build\.gradle(?:\.kts)?$/.test(path))) return "JVM project";
    if (manifests.includes("CMakeLists.txt") || manifests.includes("Makefile")) return "Native project";
    if (manifests.includes("composer.json")) return "PHP project";
    if (manifests.includes("Gemfile")) return "Ruby project";
    if (manifests.includes("pubspec.yaml")) return "Dart or Flutter project";
    return "Workspace";
}

export function buildProjectMap(nodes: FileNode[]): ProjectMap {
    const files: ProjectFile[] = [];
    let totalFolders = 0;
    let generatedFiles = 0;
    let sensitiveFiles = 0;
    const walk = (entries: FileNode[]) => {
        for (const entry of entries) {
            if (entry.type === "folder") {
                totalFolders += 1;
                if (entry.children) walk(entry.children);
                continue;
            }
            if (generatedSegment.test(entry.path)) generatedFiles += 1;
            if (isSensitiveProjectPath(entry.path)) sensitiveFiles += 1;
            files.push({ path: entry.path, name: entry.name, language: entry.language });
        }
    };
    walk(nodes);
    const manifests = files.filter((file) => manifestNames.has(file.name)).map((file) => file.path).sort();
    const entryPoints = files.filter((file) => entryName.test(file.path) && !generatedSegment.test(file.path) && !isSensitiveProjectPath(file.path)).map((file) => file.path).sort().slice(0, 12);
    const tests = files.filter((file) => testPath.test(file.path) && !generatedSegment.test(file.path) && !isSensitiveProjectPath(file.path)).map((file) => file.path).sort().slice(0, 24);
    const counts = new Map<string, number>();
    for (const file of files) {
        if (generatedSegment.test(file.path) || isSensitiveProjectPath(file.path)) continue;
        const language = languageFor(file);
        counts.set(language, (counts.get(language) || 0) + 1);
    }
    const languages = Array.from(counts, ([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, 8);
    return {
        projectKind: projectKind(manifests.map((path) => path.split("/").pop() || path)),
        totalFiles: files.length,
        totalFolders,
        generatedFiles,
        sensitiveFiles,
        languages,
        manifests,
        entryPoints,
        tests,
    };
}

export function projectMapContext(map: ProjectMap) {
    const lines = [
        `Project type: ${map.projectKind}`,
        `Workspace: ${map.totalFiles} files, ${map.totalFolders} folders`,
        `Languages: ${map.languages.length ? map.languages.map((item) => `${item.name} (${item.count})`).join(", ") : "not detected"}`,
    ];
    if (map.manifests.length) lines.push(`Manifests: ${map.manifests.slice(0, 12).join(", ")}`);
    if (map.entryPoints.length) lines.push(`Likely entry points: ${map.entryPoints.join(", ")}`);
    if (map.tests.length) lines.push(`Test files: ${map.tests.slice(0, 12).join(", ")}`);
    if (map.generatedFiles) lines.push(`Generated files excluded from context: ${map.generatedFiles}`);
    if (map.sensitiveFiles) lines.push(`Sensitive paths excluded from context: ${map.sensitiveFiles}`);
    return lines.join("\n");
}

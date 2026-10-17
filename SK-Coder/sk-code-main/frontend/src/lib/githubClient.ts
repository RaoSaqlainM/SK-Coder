import type { Codespace, FileNode } from "../types/ide";
import { loadBrowserBlob } from "./browserStorage";
const GH_API = "https://api.github.com";

type GitHubFileContent = {
    content?: string;
    reason?: string;
};

function bytesToBase64(bytes: Uint8Array): string {
    let binary = "";
    const chunkBytes = 32768;
    for (let offset = 0; offset < bytes.length; offset += chunkBytes)
        binary += String.fromCharCode(...bytes.subarray(offset, Math.min(bytes.length, offset + chunkBytes)));
    return btoa(binary);
}

function textToBase64(text: string): string {
    return btoa(unescape(encodeURIComponent(text)));
}

export async function encodeGitHubFileContent(node: Pick<FileNode, "content" | "assetBlobId" | "assetData">): Promise<GitHubFileContent> {
    if (node.assetBlobId) {
        const blob = await loadBrowserBlob(node.assetBlobId);
        if (!blob)
            return { reason: "The browser copy of this file is no longer available" };
        return { content: bytesToBase64(new Uint8Array(await blob.arrayBuffer())) };
    }
    if (node.assetData?.startsWith("data:")) {
        const separator = node.assetData.indexOf(",");
        if (separator < 0)
            return { reason: "This browser asset has an invalid local data URL" };
        const metadata = node.assetData.slice(0, separator);
        const payload = node.assetData.slice(separator + 1);
        return { content: metadata.includes(";base64") ? payload : textToBase64(decodeURIComponent(payload)) };
    }
    return { content: textToBase64(node.content || "") };
}
export async function validateGitHubToken(token: string): Promise<{
    valid: boolean;
    username: string;
}> {
    if (!token)
        return { valid: false, username: "" };
    try {
        const res = await fetch(`${GH_API}/user`, {
            headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
        });
        if (!res.ok)
            return { valid: false, username: "" };
        const data = await res.json();
        return { valid: true, username: data.login || "" };
    }
    catch {
        return { valid: false, username: "" };
    }
}
export async function listCodespaces(token: string): Promise<Codespace[]> {
    if (!token)
        return [];
    try {
        const res = await fetch(`${GH_API}/user/codespaces`, {
            headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
        });
        if (!res.ok)
            return [];
        const data = await res.json();
        return (data.codespaces as Codespace[]) || [];
    }
    catch {
        return [];
    }
}
export async function createCodespace(token: string, repoFullName: string, branch = "main"): Promise<Codespace | null> {
    if (!token)
        return null;
    try {
        const [owner, repo] = repoFullName.split("/");
        const res = await fetch(`${GH_API}/repos/${owner}/${repo}/codespaces`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/vnd.github+json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ ref: branch, machine: "basicLinux32gb" }),
        });
        if (!res.ok)
            return null;
        return (await res.json()) as Codespace;
    }
    catch {
        return null;
    }
}
export async function startCodespace(token: string, name: string): Promise<boolean> {
    if (!token || !name)
        return false;
    try {
        const res = await fetch(`${GH_API}/user/codespaces/${name}/start`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
        });
        return res.ok;
    }
    catch {
        return false;
    }
}
export async function stopCodespace(token: string, name: string): Promise<boolean> {
    if (!token || !name)
        return false;
    try {
        const res = await fetch(`${GH_API}/user/codespaces/${name}/stop`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
        });
        return res.ok;
    }
    catch {
        return false;
    }
}
export async function deleteCodespace(token: string, name: string): Promise<boolean> {
    if (!token || !name)
        return false;
    try {
        const res = await fetch(`${GH_API}/user/codespaces/${name}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
        });
        return res.ok;
    }
    catch {
        return false;
    }
}
export function getCodespaceWebUrl(codespace: Codespace): string {
    return codespace.web_url || `https://${codespace.name}.github.dev`;
}
export async function listUserRepos(token: string): Promise<{
    id: number;
    full_name: string;
    name: string;
    default_branch: string;
    private: boolean;
    html_url: string;
}[]> {
    if (!token)
        return [];
    try {
        const res = await fetch(`${GH_API}/user/repos?per_page=100&sort=updated`, {
            headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
        });
        if (!res.ok)
            return [];
        return await res.json();
    }
    catch {
        return [];
    }
}
export async function createRepo(token: string, name: string, description: string, isPrivate: boolean): Promise<{
    full_name: string;
    name: string;
    html_url: string;
} | null> {
    if (!token || !name)
        return null;
    try {
        const res = await fetch(`${GH_API}/user/repos`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/vnd.github+json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                name,
                description,
                private: isPrivate,
                auto_init: true,
            }),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error((err as {
                message?: string;
            }).message || `HTTP ${res.status}`);
        }
        return await res.json();
    }
    catch (e) {
        throw e;
    }
}
export async function renameRepo(token: string, owner: string, repo: string, newName: string): Promise<boolean> {
    if (!token || !owner || !repo || !newName)
        return false;
    try {
        const res = await fetch(`${GH_API}/repos/${owner}/${repo}`, {
            method: "PATCH",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/vnd.github+json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ name: newName }),
        });
        return res.ok;
    }
    catch {
        return false;
    }
}
type GitTreeEntry = {
    path: string;
    type: string;
    size?: number;
};
const MAX_IMPORT_FILES = 200;
const MAX_IMPORT_FILE_BYTES = 512 * 1024;
const MAX_IMPORT_TOTAL_BYTES = 5 * 1024 * 1024;
const BINARY_EXTENSION = /\.(?:7z|apk|avi|bin|bmp|class|dll|dmg|exe|gif|gz|ico|jar|jpeg|jpg|mp3|mp4|otf|pdf|png|so|tar|ttf|wav|webm|woff2?|zip)$/i;
function makeImportId(path: string, index: number): string {
    return `github-${Date.now().toString(36)}-${index}-${path.replace(/[^a-z0-9]/gi, "-").slice(-32)}`;
}
function createFolder(name: string, path: string, index: number): FileNode {
    return { id: makeImportId(path, index), name, type: "folder", path, children: [] };
}
export async function importRepositoryToTree(token: string, repoFullName: string, branch: string, rootName: string): Promise<{
    root: FileNode;
    imported: number;
    skipped: number;
}> {
    const [owner, repo] = repoFullName.split("/");
    if (!token || !owner || !repo)
        throw new Error("Choose a repository first");
    const headers = { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" };
    const treeResponse = await fetch(`${GH_API}/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`, { headers });
    if (!treeResponse.ok)
        throw new Error(treeResponse.status === 403 ? "Token cannot read this repository" : "Could not read the repository tree");
    const treeData = await treeResponse.json() as {
        tree?: GitTreeEntry[];
        truncated?: boolean;
    };
    if (treeData.truncated)
        throw new Error("Repository is too large to import safely. Import a smaller project or use Codespaces.");
    const files = (treeData.tree || []).filter((entry) => entry.type === "blob" && !BINARY_EXTENSION.test(entry.path) && (entry.size || 0) <= MAX_IMPORT_FILE_BYTES);
    const selected = files.slice(0, MAX_IMPORT_FILES);
    const root = createFolder(rootName, `/${rootName}`, 0);
    let imported = 0;
    let skipped = files.length - selected.length;
    let totalBytes = 0;
    for (const entry of selected) {
        const declaredSize = entry.size || 0;
        if (totalBytes + declaredSize > MAX_IMPORT_TOTAL_BYTES) {
            skipped += 1;
            continue;
        }
        const contentResponse = await fetch(`${GH_API}/repos/${owner}/${repo}/contents/${entry.path.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(branch)}`, { headers: { ...headers, Accept: "application/vnd.github.raw+json" } });
        if (!contentResponse.ok) {
            skipped += 1;
            continue;
        }
        const content = await contentResponse.text();
        const parts = entry.path.split("/").filter(Boolean);
        const fileName = parts.pop();
        if (!fileName) {
            skipped += 1;
            continue;
        }
        let parent = root;
        let currentPath = root.path;
        parts.forEach((part, index) => {
            currentPath = `${currentPath}/${part}`;
            let child = parent.children?.find((item) => item.type === "folder" && item.name === part);
            if (!child) {
                child = createFolder(part, currentPath, imported + index + 1);
                parent.children = [...(parent.children || []), child];
            }
            parent = child;
        });
        parent.children = [...(parent.children || []), {
                id: makeImportId(entry.path, imported + 1),
                name: fileName,
                type: "file",
                path: `${parent.path}/${fileName}`,
                content,
            }];
        totalBytes += content.length;
        imported += 1;
    }
    if (!imported)
        throw new Error("No supported text files were available to import");
    return { root, imported, skipped };
}
export async function pushFilesToRepo(token: string, owner: string, repo: string, files: FileNode[], onProgress?: (done: number, total: number) => void, commitMessage = "Update via SK Coder"): Promise<{
    success: number;
    failed: number;
    skipped: { path: string; reason: string }[];
    failures: { path: string; reason: string }[];
}> {
    const flatFiles: { path: string; node: FileNode }[] = [];
    function flatten(nodes: FileNode[], base = "") {
        for (const node of nodes) {
            if (node.type === "file") {
                const filePath = node.path.replace(/^\//, "").replace(/^[^/]+\//, "");
                flatFiles.push({ path: filePath || node.name, node });
            }
            if (node.children)
                flatten(node.children, base);
        }
    }
    flatten(files);
    let success = 0;
    let failed = 0;
    let done = 0;
    const skipped: { path: string; reason: string }[] = [];
    const failures: { path: string; reason: string }[] = [];
    for (const file of flatFiles) {
        const source: GitHubFileContent = await encodeGitHubFileContent(file.node).catch((): GitHubFileContent => ({ reason: "This browser file could not be prepared for GitHub" }));
        if (source.content === undefined) {
            skipped.push({ path: file.path, reason: source.reason || "This browser file could not be prepared for GitHub" });
            done++;
            onProgress?.(done, flatFiles.length);
            continue;
        }
        try {
            let sha: string | undefined;
            const checkRes = await fetch(`${GH_API}/repos/${owner}/${repo}/contents/${file.path}`, {
                headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
            });
            if (checkRes.ok) {
                const existing = await checkRes.json();
                sha = existing.sha;
            }
            const body: Record<string, string> = {
                message: commitMessage,
                content: source.content,
            };
            if (sha)
                body.sha = sha;
            const putRes = await fetch(`${GH_API}/repos/${owner}/${repo}/contents/${file.path}`, {
                method: "PUT",
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: "application/vnd.github+json",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(body),
            });
            if (putRes.ok)
                success++;
            else {
                failed++;
                const error = await putRes.json().catch(() => ({})) as { message?: string };
                failures.push({ path: file.path, reason: error.message || `GitHub returned HTTP ${putRes.status}` });
            }
        }
        catch {
            failed++;
            failures.push({ path: file.path, reason: "Network request failed" });
        }
        done++;
        onProgress?.(done, flatFiles.length);
    }
    return { success, failed, skipped, failures };
}

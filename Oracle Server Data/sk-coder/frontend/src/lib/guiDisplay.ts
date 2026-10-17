import { createGuiSession, removeGuiSession } from "@/lib/backendRunner";
import { mirrorWholeWorkspace } from "@/lib/wholeWorkspaceMirror";
import type { FileNode } from "@/types/ide";

export type GuiDisplaySession = {
    id: string;
    workspaceSessionId: string;
    filePath: string | null;
    status: "staging" | "running";
    expiresAt: number;
    viewUrl: string | null;
    log?: string;
};

const API_BASE = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");

function getDeviceId() {
    let id = localStorage.getItem("sk-device-id");
    if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem("sk-device-id", id);
    }
    return id;
}

function headers() {
    const workspaceAccess = localStorage.getItem("sk-coder-workspace-terminal-access");
    return { "Content-Type": "application/json", "X-Device-Id": getDeviceId(), ...(workspaceAccess ? { "X-SK-Workspace-Access": workspaceAccess } : {}) };
}

function fromServer(value: {
    id: string;
    workspaceSessionId: string;
    filePath: string | null;
    status: "staging" | "running";
    expiresAt: number;
    viewPath: string | null;
    log?: string;
}): GuiDisplaySession {
    return { ...value, viewUrl: value.viewPath ? `${API_BASE}${value.viewPath}` : null };
}

async function request<T>(path: string, method: "GET" | "POST", body?: unknown) {
    const response = await fetch(`${API_BASE}${path}`, {
        method,
        headers: headers(),
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(60000),
    });
    const data = await response.json().catch(() => ({ error: response.statusText })) as T & { error?: string };
    if (!response.ok)
        throw new Error(data.error || response.statusText);
    return data;
}

export async function launchGuiDisplay(file: FileNode, fileTree: FileNode[], _onProgress?: (completed: number, total: number) => void) {
    const workspace = await mirrorWholeWorkspace(fileTree);
    const initial = await createGuiSession(workspace.sessionId);
    try {
        return fromServer(await request<{
            id: string;
            workspaceSessionId: string;
            filePath: string | null;
            status: "staging" | "running";
            expiresAt: number;
            viewPath: string | null;
        }>(`/gui/sessions/${encodeURIComponent(initial.id)}/launch`, "POST", { filePath: file.path, language: file.path.split(".").pop()?.toLowerCase() }));
    }
    catch (error) {
        await removeGuiSession(initial.id).catch(() => undefined);
        throw error;
    }
}

export async function getGuiDisplayStatus(id: string) {
    return fromServer(await request<{
        id: string;
        workspaceSessionId: string;
        filePath: string | null;
        status: "staging" | "running";
        expiresAt: number;
        viewPath: string | null;
        log?: string;
    }>(`/gui/sessions/${encodeURIComponent(id)}`, "GET"));
}

export async function stopGuiDisplay(id: string) {
    await removeGuiSession(id);
}

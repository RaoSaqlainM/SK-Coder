import { createWebPreviewSession, getWebPreviewSession, launchWebPreviewSession, removeWebPreviewSession } from "@/lib/backendRunner";
import { mirrorWholeWorkspace } from "@/lib/wholeWorkspaceMirror";
import type { FileNode } from "@/types/ide";

export type WebPreviewSession = {
    id: string;
    workspaceSessionId: string;
    projectPath: string | null;
    kind: "vite" | "next" | null;
    status: "staging" | "running";
    expiresAt: number;
    viewUrl: string | null;
    log?: string;
};

const API_BASE = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");

function fromServer(value: Omit<WebPreviewSession, "viewUrl"> & { viewPath: string | null }): WebPreviewSession {
    return { ...value, viewUrl: value.viewPath ? `${API_BASE}${value.viewPath}` : null };
}

export async function launchWebProjectPreview(project: FileNode, fileTree: FileNode[], _onProgress?: (completed: number, total: number) => void) {
    const workspace = await mirrorWholeWorkspace(fileTree);
    const initial = await createWebPreviewSession(workspace.sessionId);
    try {
        return fromServer(await launchWebPreviewSession(initial.id, project.path));
    }
    catch (error) {
        await removeWebPreviewSession(initial.id).catch(() => undefined);
        throw error;
    }
}

export async function getWebProjectPreviewStatus(id: string) {
    return fromServer(await getWebPreviewSession(id));
}

export async function stopWebProjectPreview(id: string) {
    await removeWebPreviewSession(id);
}

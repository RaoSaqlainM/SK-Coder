export type PermissionAction = "read" | "write" | "execute";
export type PermissionDecision = "allow-once" | "allow-scope" | "deny";
export type PermissionGrant = {
    action: PermissionAction;
    scope: string;
    createdAt: number;
    decision: PermissionDecision;
};
const STORAGE_KEY = "sk-coder-permission-grants-v1";
function normalizeScope(scope: string): string {
    const cleaned = scope.trim().toLowerCase();
    return cleaned || "workspace";
}
export function classifyPermissionRequest(prompt: string): PermissionAction | null {
    const text = prompt.toLowerCase();
    const writeWords = /\b(edit|write|modify|create|delete|save|rename|append|replace|change|update|new file|new folder)\b/;
    const executeWords = /\b(run|execute|install|deploy|launch|test|build|compile|start|open in terminal|terminal)\b/;
    if (writeWords.test(text))
        return "write";
    if (executeWords.test(text))
        return "execute";
    if (/\b(explain|summarize|describe|show|read|inspect|list|what does|help me understand)\b/.test(text))
        return "read";
    return null;
}
export function formatPermissionLabel(action: PermissionAction): string {
    switch (action) {
        case "write": return "write";
        case "execute": return "execute";
        default: return "read";
    }
}
export function loadPermissionGrants(): PermissionGrant[] {
    if (typeof window === "undefined")
        return [];
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw)
            return [];
        const parsed = JSON.parse(raw) as PermissionGrant[];
        return Array.isArray(parsed) ? parsed : [];
    }
    catch {
        return [];
    }
}
export function applyPermissionDecision(action: PermissionAction, scope: string, decision: PermissionDecision): PermissionGrant[] {
    if (decision === "allow-once")
        return loadPermissionGrants();
    const grants = loadPermissionGrants();
    const next = [
        ...grants.filter((entry) => !(entry.action === action && entry.scope === normalizeScope(scope))),
        { action, scope: normalizeScope(scope), createdAt: Date.now(), decision },
    ];
    if (typeof window !== "undefined") {
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        }
        catch {
        }
    }
    return next;
}
export function savePermissionGrant(action: PermissionAction, scope: string, decision: PermissionDecision = "allow-scope"): PermissionGrant[] {
    return applyPermissionDecision(action, scope, decision);
}
export function clearPermissionGrants(): void {
    if (typeof window !== "undefined") {
        try {
            window.localStorage.removeItem(STORAGE_KEY);
        }
        catch {
        }
    }
}
export function isPermissionGranted(action: PermissionAction, scope: string, grants: PermissionGrant[] = loadPermissionGrants()): boolean {
    const target = normalizeScope(scope);
    return grants.some((entry) => entry.action === action && entry.scope === target);
}
export function shouldPromptForPermission(action: PermissionAction, scope: string, requireApproval: boolean, grants: PermissionGrant[] = loadPermissionGrants()): boolean {
    if (!requireApproval || action === "read")
        return false;
    return !isPermissionGranted(action, scope, grants);
}

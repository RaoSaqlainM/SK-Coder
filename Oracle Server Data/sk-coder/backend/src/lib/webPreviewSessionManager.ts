import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { hostname } from "node:os";
import { normalize, relative, resolve } from "node:path";
import { spawn } from "node:child_process";
import { BACKEND_INSTANCE_ID, PREVIEW_RUNTIME_IMAGE, PREVIEW_SESSION_MAX_COUNT, PREVIEW_SESSION_MEMORY_MB, PREVIEW_SESSION_TTL_MS } from "./backendConfig.js";
import { authorizeTerminalSession, createWorkspaceSession, destroyWorkspaceSession, getWorkspaceSession } from "./sessionManager.js";
import { beginRuntimeOperationFinalization, completeRuntimeOperationFinalization, createRuntimeOperation, failRuntimeOperationFinalization } from "./operationRegistry.js";

type CommandResult = { stdout: string; stderr: string; exitCode: number };
type PreviewKind = "vite" | "next";
type WebPreviewSession = {
    id: string;
    deviceId: string;
    workspaceSessionId: string;
    ownsWorkspace: boolean;
    token: string;
    projectPath: string | null;
    kind: PreviewKind | null;
    containerName: string | null;
    host: string | null;
    port: number | null;
    expiresAt: number;
};

const sessions = new Map<string, WebPreviewSession>();
let cleanupStarted = false;
const PREVIEW_NETWORK = "skcoder-preview";

function run(command: string, args: string[], timeout = 30000): Promise<CommandResult> {
    return new Promise((resolveResult) => {
        const proc = spawn(command, args, { env: { ...process.env, NO_COLOR: "1" } });
        let stdout = "";
        let stderr = "";
        let timedOut = false;
        const timer = setTimeout(() => {
            timedOut = true;
            proc.kill("SIGTERM");
            setTimeout(() => proc.kill("SIGKILL"), 1000).unref();
        }, timeout);
        proc.stdout.on("data", (value: Buffer) => { stdout += value.toString(); });
        proc.stderr.on("data", (value: Buffer) => { stderr += value.toString(); });
        proc.once("error", (error) => {
            clearTimeout(timer);
            resolveResult({ stdout: "", stderr: error.message, exitCode: 127 });
        });
        proc.once("close", (code) => {
            clearTimeout(timer);
            resolveResult({ stdout: stdout.slice(0, 65536), stderr: `${stderr}${timedOut ? "\nCommand timed out." : ""}`.trim(), exitCode: code ?? 1 });
        });
    });
}

function safeProjectPath(pathname: string) {
    const value = normalize(pathname.trim().replace(/^\/+/, "") || ".");
    if (value === ".." || value.startsWith("../") || value.startsWith("..\\"))
        throw new Error("A project folder inside the workspace is required.");
    return value.replaceAll("\\", "/");
}

function containerNameFor(id: string) {
    return `skcoder-preview-${id.replaceAll("-", "")}`;
}

function viewPath(session: WebPreviewSession) {
    return `/previews/sessions/${encodeURIComponent(session.id)}/view/${encodeURIComponent(session.token)}/`;
}

function wait(milliseconds: number) {
    return new Promise<void>((resolveResult) => setTimeout(resolveResult, milliseconds));
}

async function previewStartupLog(containerName: string) {
    const result = await run("docker", ["exec", "--user", "1000:1000", containerName, "bash", "-lc", "tail -c 16384 /tmp/skcoder-preview.log 2>/dev/null || true"], 10000);
    return result.stdout.trim();
}

async function waitForPreviewReady(containerName: string) {
    let log = "";
    for (let attempt = 0; attempt < 8; attempt += 1) {
        await wait(500);
        const ready = await run("docker", ["exec", "--user", "1000:1000", containerName, "bash", "-lc", "curl --silent --show-error --fail --max-time 1 http://127.0.0.1:4173/ >/dev/null"], 5000);
        if (ready.exitCode === 0)
            return;
        log = await previewStartupLog(containerName);
    }
    throw new Error(`Project preview did not become ready.${log ? `\n${log}` : ""}`);
}

function publicSession(session: WebPreviewSession, log = "") {
    return {
        id: session.id,
        workspaceSessionId: session.workspaceSessionId,
        projectPath: session.projectPath,
        kind: session.kind,
        status: session.containerName ? "running" : "staging",
        expiresAt: session.expiresAt,
        viewPath: session.containerName ? viewPath(session) : null,
        log,
    };
}

async function activeCount() {
    const result = await run("docker", ["ps", "--filter", "label=skcoder.preview=true", "--filter", `label=skcoder.instance=${BACKEND_INSTANCE_ID}`, "-q"], 5000);
    return result.stdout.split("\n").filter(Boolean).length;
}

async function ensurePreviewNetwork() {
    const existing = await run("docker", ["network", "inspect", PREVIEW_NETWORK], 10000);
    if (existing.exitCode !== 0) {
        const created = await run("docker", ["network", "create", "--driver", "bridge", "--internal", PREVIEW_NETWORK], 10000);
        if (created.exitCode !== 0) {
            const afterCreate = await run("docker", ["network", "inspect", PREVIEW_NETWORK], 10000);
            if (afterCreate.exitCode !== 0)
                throw new Error(created.stderr || "The isolated preview network could not be created.");
        }
    }
    const joined = await run("docker", ["network", "connect", PREVIEW_NETWORK, hostname()], 10000);
    if (joined.exitCode !== 0 && !joined.stderr.includes("already exists"))
        throw new Error(joined.stderr || "The preview proxy could not join the isolated preview network.");
}

async function ownedSession(id: string, deviceId: string, workspaceAccess: string | null | undefined) {
    await removeExpiredWebPreviewSessions();
    const session = sessions.get(id);
    if (!session || session.deviceId !== deviceId || !(await authorizeTerminalSession(session.workspaceSessionId, workspaceAccess)))
        throw new Error("Project preview session not found or expired.");
    return session;
}

async function detectProject(workspacePath: string, projectPath: string): Promise<{ kind: PreviewKind; command: string }> {
    const relativeProject = safeProjectPath(projectPath);
    const directory = resolve(workspacePath, relativeProject);
    if (relative(workspacePath, directory).startsWith(".."))
        throw new Error("Project path escapes the workspace.");
    let manifest: { scripts?: Record<string, string>; dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    try {
        manifest = JSON.parse(await readFile(resolve(directory, "package.json"), "utf8")) as typeof manifest;
    }
    catch {
        throw new Error("A readable package.json is required for project preview.");
    }
    const packages = { ...manifest.dependencies, ...manifest.devDependencies };
    if (packages.next && manifest.scripts?.dev)
        return { kind: "next", command: "npm run dev -- --hostname 0.0.0.0 --port 4173" };
    if (packages.vite && manifest.scripts?.dev)
        return { kind: "vite", command: "npm run dev -- --host 0.0.0.0 --port 4173 --strictPort" };
    throw new Error("Project preview currently supports Vite and Next.js projects with a dev script. Install dependencies first, then start preview.");
}

export async function createWebPreviewSession(deviceId: string, workspaceSessionId?: string) {
    await removeExpiredWebPreviewSessions();
    if (await activeCount() >= PREVIEW_SESSION_MAX_COUNT)
        throw new Error("The project preview queue is full. Stop an existing preview before starting another.");
    const workspace = workspaceSessionId ? await getWorkspaceSession(workspaceSessionId) : await createWorkspaceSession({ retentionMode: "four-hours" });
    const session: WebPreviewSession = {
        id: randomUUID(), deviceId, workspaceSessionId: workspace.id, ownsWorkspace: !workspaceSessionId, token: randomBytes(24).toString("base64url"), projectPath: null, kind: null, containerName: null, host: null, port: null, expiresAt: Date.now() + PREVIEW_SESSION_TTL_MS,
    };
    await createRuntimeOperation({ id: `preview:${session.id}`, ownerId: session.id, kind: "preview", resources: [`workspace:${workspace.id}`], expiresAt: session.expiresAt });
    sessions.set(session.id, session);
    startCleanup();
    return publicSession(session);
}

export async function launchWebPreviewSession(id: string, deviceId: string, workspaceAccess: string | null | undefined, projectPath: string) {
    const session = await ownedSession(id, deviceId, workspaceAccess);
    if (session.containerName)
        throw new Error("This project preview is already running.");
    if (await activeCount() >= PREVIEW_SESSION_MAX_COUNT)
        throw new Error("The project preview queue is full. Stop an existing preview before starting another.");
    const workspace = await getWorkspaceSession(session.workspaceSessionId);
    const project = await detectProject(workspace.workspacePath, projectPath);
    const relativeProject = safeProjectPath(projectPath);
    const containerName = containerNameFor(session.id);
    await ensurePreviewNetwork();
    const started = await run("docker", [
        "run", "-d", "--rm", "--name", containerName, "--label", "skcoder.preview=true", "--label", `skcoder.preview-id=${session.id}`, "--label", `skcoder.instance=${BACKEND_INSTANCE_ID}`,
        "--network", PREVIEW_NETWORK, "--memory", `${PREVIEW_SESSION_MEMORY_MB}m`, "--memory-swap", `${PREVIEW_SESSION_MEMORY_MB}m`, "--cpus", "1", "--pids-limit", "192",
        "--cap-drop", "ALL", "--security-opt", "no-new-privileges", "--read-only", "--user", "1000:1000", "-v", `${workspace.workspacePath}:/workspace:rw`, "-w", `/workspace/${relativeProject === "." ? "" : relativeProject}`,
        "--tmpfs", "/tmp:rw,noexec,nosuid,size=256m,mode=1777", PREVIEW_RUNTIME_IMAGE, "bash", "-lc", "sleep infinity",
    ], 45000);
    if (started.exitCode !== 0)
        throw new Error(started.stderr || "The preview runtime could not start.");
    const port = 4173;
    const previewEnv = project.kind === "vite" ? [`-e`, `__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS=${containerName}`] : [];
    const launched = await run("docker", ["exec", "-d", "--user", "1000:1000", ...previewEnv, "-w", `/workspace/${relativeProject === "." ? "" : relativeProject}`, containerName, "bash", "-lc", `${project.command} > /tmp/skcoder-preview.log 2>&1`], 15000);
    if (launched.exitCode !== 0) {
        await run("docker", ["rm", "-f", containerName], 10000);
        throw new Error(launched.stderr || "The project preview command could not start.");
    }
    try {
        await waitForPreviewReady(containerName);
    }
    catch (error) {
        await run("docker", ["rm", "-f", containerName], 10000);
        throw error;
    }
    session.projectPath = projectPath;
    session.kind = project.kind;
    session.containerName = containerName;
    session.host = containerName;
    session.port = port;
    session.expiresAt = Date.now() + PREVIEW_SESSION_TTL_MS;
    await createRuntimeOperation({ id: `preview:${session.id}`, ownerId: session.id, kind: "preview", resources: [`workspace:${session.workspaceSessionId}`, `container:${containerName}`], expiresAt: session.expiresAt });
    return publicSession(session);
}

export async function getWebPreviewTarget(id: string, token: string) {
    await removeExpiredWebPreviewSessions();
    const session = sessions.get(id);
    if (!session || session.token !== token || !session.port || !session.host || !session.containerName)
        throw new Error("Project preview session not found or expired.");
    return { host: session.host, port: session.port };
}

export async function getWebPreviewSessionStatus(id: string, deviceId: string, workspaceAccess: string | null | undefined) {
    const session = await ownedSession(id, deviceId, workspaceAccess);
    let log = "";
    if (session.containerName) {
        const result = await run("docker", ["exec", "--user", "1000:1000", session.containerName, "bash", "-lc", "tail -c 16384 /tmp/skcoder-preview.log 2>/dev/null || true"], 10000);
        log = result.stdout;
    }
    return publicSession(session, log);
}

export async function stopWebPreviewSession(id: string, deviceId: string, workspaceAccess: string | null | undefined) {
    await removeWebPreviewSession(await ownedSession(id, deviceId, workspaceAccess));
}

async function removeWebPreviewSession(session: WebPreviewSession) {
    sessions.delete(session.id);
    await beginRuntimeOperationFinalization(`preview:${session.id}`, session.id, "preview");
    try {
        if (session.containerName)
            await run("docker", ["rm", "-f", session.containerName], 10000);
        if (session.ownsWorkspace)
            await destroyWorkspaceSession(session.workspaceSessionId);
        await completeRuntimeOperationFinalization(`preview:${session.id}`, session.id, "preview");
    }
    catch (error) {
        await failRuntimeOperationFinalization(`preview:${session.id}`, session.id, error);
        throw error;
    }
}

export async function removeExpiredWebPreviewSessions() {
    const now = Date.now();
    for (const session of [...sessions.values()])
        if (session.expiresAt <= now)
            await removeWebPreviewSession(session);
}

function startCleanup() {
    if (cleanupStarted)
        return;
    cleanupStarted = true;
    const timer = setInterval(() => void removeExpiredWebPreviewSessions(), 30000);
    timer.unref();
}

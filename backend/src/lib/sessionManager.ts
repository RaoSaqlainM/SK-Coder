import { ChildProcess, spawn } from "node:child_process"
import { chmod, mkdir, rm, stat, writeFile } from "node:fs/promises"
import { randomUUID } from "node:crypto"
import { dirname, join, normalize, relative, resolve } from "node:path"
import { COMMAND_TIMEOUT_MS, RUNTIME_IMAGE, SESSION_MAX_BYTES, SESSION_MAX_COUNT, SESSION_TTL_HOURS, WORKSPACE_MAX_BYTES, WORKSPACE_ROOT } from "./backendConfig"

export type CommandResult = { stdout: string; stderr: string; exitCode: number; executionTime: number }
export type WorkspaceSession = { id: string; containerName: string; workspacePath: string; createdAt: number; lastUsedAt: number }
export type WorkspaceFile = { path: string; content: string }

const sessions = new Map<string, WorkspaceSession>()
let dockerReady: boolean | null = null
let cleanupStarted = false

function run(command: string, args: string[], timeout = COMMAND_TIMEOUT_MS, input?: string): Promise<CommandResult> {
  return new Promise((complete) => {
    const started = Date.now()
    const proc = spawn(command, args, { env: { ...process.env, NO_COLOR: "1" } })
    let stdout = ""
    let stderr = ""
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      proc.kill("SIGTERM")
      setTimeout(() => proc.kill("SIGKILL"), 1000).unref()
    }, timeout)
    if (input) proc.stdin.write(input)
    proc.stdin.end()
    proc.stdout.on("data", (data: Buffer) => { stdout += data.toString() })
    proc.stderr.on("data", (data: Buffer) => { stderr += data.toString() })
    proc.once("error", (error) => {
      clearTimeout(timer)
      complete({ stdout: "", stderr: error.message, exitCode: 127, executionTime: Date.now() - started })
    })
    proc.once("close", (code) => {
      clearTimeout(timer)
      complete({ stdout: stdout.slice(0, 500000), stderr: `${stderr}${timedOut ? "\nCommand timed out." : ""}`.trim(), exitCode: code ?? 1, executionTime: Date.now() - started })
    })
  })
}

function sessionPath(id: string) {
  return resolve(WORKSPACE_ROOT, id)
}

function safeRelativePath(pathname: string) {
  const requested = pathname.trim().replace(/^\/+/, "") || "."
  const value = normalize(requested)
  if (value === ".." || value.startsWith("../") || value.startsWith("..\\")) throw new Error("Workspace path escapes the session root.")
  return value
}

async function checkWorkspaceSize(workspacePath: string) {
  const result = await run("du", ["-sb", workspacePath], 5000)
  const bytes = Number(result.stdout.split(/\s+/)[0])
  if (Number.isFinite(bytes) && bytes > SESSION_MAX_BYTES) throw new Error("Workspace storage limit reached.")
}

async function checkWorkspaceCapacity() {
  const result = await run("du", ["-sb", WORKSPACE_ROOT], 5000)
  const bytes = Number(result.stdout.split(/\s+/)[0])
  if (Number.isFinite(bytes) && bytes >= WORKSPACE_MAX_BYTES) throw new Error("Server workspace capacity reached. Keep the project in browser storage or use a public execution fallback.")
}

export async function ensureDockerReady() {
  if (dockerReady !== null) return dockerReady
  const result = await run("docker", ["version", "--format", "{{.Server.Version}}"], 5000)
  dockerReady = result.exitCode === 0 && Boolean(result.stdout.trim())
  return dockerReady
}

export async function createWorkspaceSession() {
  if (!(await ensureDockerReady())) throw new Error("The isolated runtime service is not available.")
  if (sessions.size >= SESSION_MAX_COUNT) throw new Error("The server has reached its active workspace limit.")
  await mkdir(WORKSPACE_ROOT, { recursive: true, mode: 0o700 })
  await checkWorkspaceCapacity()
  const id = randomUUID()
  const workspacePath = sessionPath(id)
  const containerName = `skcoder-${id.replace(/-/g, "")}`
  await mkdir(workspacePath, { recursive: true, mode: 0o777 })
  await chmod(workspacePath, 0o777)
  const started = await run("docker", [
    "run", "-d", "--rm", "--name", containerName,
    "--network", "none", "--memory", "1024m", "--memory-swap", "1024m", "--cpus", "1", "--pids-limit", "256",
    "--cap-drop", "ALL", "--security-opt", "no-new-privileges", "--user", "1000:1000",
    "-v", `${workspacePath}:/workspace:rw`, "-w", "/workspace", "--tmpfs", "/tmp:rw,size=256m,mode=1777",
    RUNTIME_IMAGE, "sleep", "infinity",
  ], 30000)
  if (started.exitCode !== 0) {
    await rm(workspacePath, { recursive: true, force: true })
    throw new Error(started.stderr || "The isolated runtime could not start.")
  }
  const session = { id, containerName, workspacePath, createdAt: Date.now(), lastUsedAt: Date.now() }
  sessions.set(id, session)
  startCleanup()
  return session
}

export async function getWorkspaceSession(id: string) {
  const session = sessions.get(id)
  if (!session) throw new Error("Workspace session not found or expired.")
  session.lastUsedAt = Date.now()
  return session
}

export async function runWorkspaceCommand(id: string, command: string, cwd = "/") {
  const session = await getWorkspaceSession(id)
  const relativeCwd = safeRelativePath(cwd)
  const workspaceCwd = relativeCwd === "." ? "/workspace" : `/workspace/${relativeCwd.replaceAll("\\", "/")}`
  const result = await run("docker", ["exec", "-i", "-w", workspaceCwd, session.containerName, "bash", "-lc", command], COMMAND_TIMEOUT_MS)
  await checkWorkspaceSize(session.workspacePath)
  return result
}

export async function syncWorkspaceFiles(id: string, files: WorkspaceFile[]) {
  const session = await getWorkspaceSession(id)
  if (files.length > 1000) throw new Error("Workspace file limit reached.")
  for (const file of files) {
    if (typeof file.path !== "string" || typeof file.content !== "string" || file.content.length > 2_000_000) throw new Error("Invalid workspace file payload.")
    const relativePath = safeRelativePath(file.path)
    if (relativePath === ".") throw new Error("A workspace file path is required.")
    const target = resolve(session.workspacePath, relativePath)
    if (relative(session.workspacePath, target).startsWith("..")) throw new Error("Workspace path escapes the session root.")
    await mkdir(dirname(target), { recursive: true, mode: 0o777 })
    await writeFile(target, file.content, "utf8")
  }
  await checkWorkspaceSize(session.workspacePath)
}

export async function runCodeInWorkspace(id: string, language: string, code: string) {
  const session = await getWorkspaceSession(id)
  const runId = randomUUID()
  const relativeRunDir = `.skcoder-runs/${runId}`
  const hostRunDir = resolve(session.workspacePath, relativeRunDir)
  if (relative(session.workspacePath, hostRunDir).startsWith("..")) throw new Error("Invalid execution path.")
  await mkdir(hostRunDir, { recursive: true, mode: 0o777 })
  await chmod(hostRunDir, 0o777)
  const normalizedLanguage = language.toLowerCase()
  const config: Record<string, { file: string; command: string }> = {
    python: { file: "main.py", command: "python3 main.py" },
    python3: { file: "main.py", command: "python3 main.py" },
    node: { file: "main.js", command: "node main.js" },
    nodejs: { file: "main.js", command: "node main.js" },
    javascript: { file: "main.js", command: "node main.js" },
    bash: { file: "main.sh", command: "bash main.sh" },
    shell: { file: "main.sh", command: "bash main.sh" },
    java: { file: "Main.java", command: "javac Main.java && java Main" },
    c: { file: "main.c", command: "gcc main.c -O2 -o main && ./main" },
    cpp: { file: "main.cpp", command: "g++ main.cpp -O2 -o main && ./main" },
    "c++": { file: "main.cpp", command: "g++ main.cpp -O2 -o main && ./main" },
    rust: { file: "main.rs", command: "rustc main.rs -O -o main && ./main" },
    go: { file: "main.go", command: "go run main.go" },
  }
  const selected = config[normalizedLanguage]
  if (!selected) throw new Error(`Unsupported runtime: ${language}`)
  await writeFile(join(hostRunDir, selected.file), code, "utf8")
  try {
    return await runWorkspaceCommand(id, selected.command, relativeRunDir)
  } finally {
    await rm(hostRunDir, { recursive: true, force: true })
  }
}

export async function openInteractiveTerminal(id: string, onStdout: (value: string) => void, onStderr: (value: string) => void, onClose: (code: number) => void) {
  const session = await getWorkspaceSession(id)
  const proc = spawn("docker", ["exec", "-i", "-w", "/workspace", session.containerName, "bash", "--noprofile", "--norc"], { env: { ...process.env, TERM: "xterm-256color", HOME: "/workspace" } })
  proc.stdout.on("data", (data: Buffer) => onStdout(data.toString()))
  proc.stderr.on("data", (data: Buffer) => onStderr(data.toString()))
  proc.once("close", (code) => onClose(code ?? 1))
  return proc
}

export async function closeWorkspaceSession(id: string) {
  const session = sessions.get(id)
  if (!session) return
  sessions.delete(id)
  await run("docker", ["rm", "-f", session.containerName], 10000)
  await rm(session.workspacePath, { recursive: true, force: true })
}

function startCleanup() {
  if (cleanupStarted) return
  cleanupStarted = true
  const interval = setInterval(async () => {
    const cutoff = Date.now() - SESSION_TTL_HOURS * 60 * 60 * 1000
    for (const session of sessions.values()) {
      if (session.lastUsedAt < cutoff) await closeWorkspaceSession(session.id)
    }
  }, 60 * 60 * 1000)
  interval.unref()
}

export async function workspaceStatus() {
  const ready = await ensureDockerReady()
  return { ready, activeSessions: sessions.size, image: RUNTIME_IMAGE }
}

export function terminateInteractiveTerminal(proc: ChildProcess) {
  proc.kill("SIGTERM")
  setTimeout(() => proc.kill("SIGKILL"), 1000).unref()
}

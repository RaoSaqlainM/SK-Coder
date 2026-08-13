import { randomUUID } from "node:crypto"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { spawn } from "node:child_process"
import path from "node:path"
import { tmpdir } from "node:os"
import { config } from "./config.js"
import { resolveRuntime, sourceForRuntime } from "./runtimes.js"

let dockerState = { checkedAt: 0, ready: false }

function runDocker(args, input, timeoutMs, containerName) {
  return new Promise((resolve) => {
    let stdout = ""
    let stderr = ""
    let timedOut = false
    let overflow = false
    const limit = 1024 * 1024
    const child = spawn("docker", args, { stdio: ["pipe", "pipe", "pipe"] })
    const stop = () => {
      spawn("docker", ["rm", "-f", containerName], { stdio: "ignore" }).unref()
      child.kill("SIGKILL")
    }
    const timer = setTimeout(() => {
      timedOut = true
      stop()
    }, timeoutMs)
    const append = (current, chunk) => {
      if (Buffer.byteLength(current) + chunk.length > limit) {
        overflow = true
        stop()
        return current
      }
      return current + chunk.toString("utf8")
    }
    child.stdout.on("data", (chunk) => { stdout = append(stdout, chunk) })
    child.stderr.on("data", (chunk) => { stderr = append(stderr, chunk) })
    child.on("error", (error) => {
      clearTimeout(timer)
      resolve({ code: 1, stdout, stderr: `${stderr}${error.message}`, timedOut, overflow })
    })
    child.on("close", (code) => {
      clearTimeout(timer)
      resolve({ code: code ?? 1, stdout, stderr, timedOut, overflow })
    })
    child.stdin.end(input)
  })
}

async function dockerReady() {
  if (Date.now() - dockerState.checkedAt < 30000) return dockerState.ready
  const probe = await new Promise((resolve) => {
    const child = spawn("docker", ["info", "--format", "{{.ServerVersion}}"], { stdio: ["ignore", "ignore", "ignore"] })
    child.on("error", () => resolve(false))
    child.on("close", (code) => resolve(code === 0))
  })
  dockerState = { checkedAt: Date.now(), ready: probe }
  return probe
}

function secureArgs(name, workspace, image, command) {
  return [
    "run", "--rm", "--name", name,
    "--network", "none",
    "--read-only",
    "--tmpfs", "/tmp:rw,noexec,nosuid,size=64m",
    "--mount", `type=bind,src=${workspace},dst=/workspace,readonly`,
    "--workdir", "/workspace",
    "--user", "65534:65534",
    "--cap-drop", "ALL",
    "--security-opt", "no-new-privileges",
    "--pids-limit", "64",
    "--memory", "256m",
    "--cpus", "0.5",
    "--ulimit", "nofile=128:128",
    image,
    ...command
  ]
}

export async function executeSource({ language, code, stdin = "" }) {
  const runtime = resolveRuntime(language)
  if (!runtime) return { ok: false, status: 400, message: "Unsupported runtime." }
  if (typeof code !== "string" || !code.trim()) return { ok: false, status: 400, message: "Source code is required." }
  if (Buffer.byteLength(code) > config.maxCodeBytes) return { ok: false, status: 413, message: "Source code exceeds the execution limit." }
  if (!await dockerReady()) return { ok: false, status: 503, message: "The isolated execution service is unavailable." }
  const workspace = await mkdtemp(path.join(tmpdir(), "sk-coder-exec-"))
  const containerName = `skcoder-${randomUUID().replaceAll("-", "").slice(0, 20)}`
  try {
    await writeFile(path.join(workspace, runtime.fileName), sourceForRuntime(runtime, code), { mode: 0o400 })
    const result = await runDocker(secureArgs(containerName, workspace, runtime.image, runtime.command), String(stdin).slice(0, 65536), config.executionTimeoutMs, containerName)
    const ok = result.code === 0 && !result.timedOut && !result.overflow
    return {
      ok,
      status: 200,
      code: result.code,
      stdout: result.stdout,
      stderr: result.stderr,
      timedOut: result.timedOut,
      overflow: result.overflow,
      runtime: runtime.id
    }
  } finally {
    await rm(workspace, { force: true, recursive: true })
  }
}

export async function executeTerminalCommand(command) {
  if (typeof command !== "string" || !command.trim() || command.length > 4096) return { ok: false, status: 400, message: "A terminal command up to 4096 characters is required." }
  if (!await dockerReady()) return { ok: false, status: 503, message: "The isolated terminal service is unavailable." }
  const workspace = await mkdtemp(path.join(tmpdir(), "sk-coder-shell-"))
  const containerName = `skterm-${randomUUID().replaceAll("-", "").slice(0, 20)}`
  try {
    const result = await runDocker(secureArgs(containerName, workspace, "alpine:3.20", ["sh", "-lc", command]), "", config.terminalTimeoutMs, containerName)
    return { ok: result.code === 0 && !result.timedOut && !result.overflow, status: 200, ...result }
  } finally {
    await rm(workspace, { force: true, recursive: true })
  }
}

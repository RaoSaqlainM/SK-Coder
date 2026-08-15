import { spawn } from "child_process"
import { mkdtemp, writeFile, rm, stat } from "fs/promises"
import { tmpdir } from "os"
import { join, resolve } from "path"

interface ExecResult {
  stdout: string
  stderr: string
  exitCode: number
  executionTime: number
}

function runProc(
  cmd: string,
  args: string[],
  opts: { cwd?: string; timeout?: number } = {}
): Promise<ExecResult> {
  const timeout = opts.timeout ?? 30000
  const start = Date.now()
  return new Promise((res) => {
    let stdout = ""
    let stderr = ""
    let killed = false
    const proc = spawn(cmd, args, {
      cwd: opts.cwd ?? tmpdir(),
      env: { ...process.env, TERM: "dumb", NO_COLOR: "1", PYTHONUNBUFFERED: "1" },
    })
    const timer = setTimeout(() => {
      killed = true
      proc.kill("SIGTERM")
      setTimeout(() => { try { proc.kill("SIGKILL") } catch {} }, 1500)
    }, timeout)
    proc.stdout.on("data", (d: Buffer) => { stdout += d.toString() })
    proc.stderr.on("data", (d: Buffer) => { stderr += d.toString() })
    proc.on("close", (code) => {
      clearTimeout(timer)
      res({
        stdout: stdout.slice(0, 200000),
        stderr: (killed ? stderr + "\n[Process killed: timeout after 30s]" : stderr).slice(0, 50000),
        exitCode: code ?? 1,
        executionTime: Date.now() - start,
      })
    })
    proc.on("error", (e) => {
      clearTimeout(timer)
      res({ stdout: "", stderr: `Failed to start ${cmd}: ${e.message}`, exitCode: 127, executionTime: Date.now() - start })
    })
  })
}

async function withTemp<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "skcoder-"))
  try { return await fn(dir) } finally { rm(dir, { recursive: true, force: true }).catch(() => {}) }
}

export async function executePython(code: string): Promise<ExecResult> {
  return withTemp(async (dir) => {
    await writeFile(join(dir, "main.py"), code, "utf8")
    return runProc("python3", [join(dir, "main.py")], { cwd: dir })
  })
}

export async function executeNode(code: string): Promise<ExecResult> {
  return withTemp(async (dir) => {
    await writeFile(join(dir, "main.js"), code, "utf8")
    return runProc("node", [join(dir, "main.js")], { cwd: dir })
  })
}

export async function executeCpp(code: string, lang: "c" | "cpp"): Promise<ExecResult> {
  return withTemp(async (dir) => {
    const ext = lang === "cpp" ? "cpp" : "c"
    const cc = lang === "cpp" ? "g++" : "gcc"
    const src = join(dir, `main.${ext}`)
    const bin = join(dir, "main_out")
    await writeFile(src, code, "utf8")
    const compile = await runProc(cc, [src, "-o", bin, "-O2", "-Wall", "-Wextra", "-lm"], { cwd: dir })
    if (compile.exitCode !== 0) return { ...compile, stdout: "" }
    const run = await runProc(bin, [], { cwd: dir })
    return {
      stdout: run.stdout,
      stderr: (compile.stderr + (run.stderr ? "\n" + run.stderr : "")).trim(),
      exitCode: run.exitCode,
      executionTime: compile.executionTime + run.executionTime,
    }
  })
}

export async function executeJava(code: string): Promise<ExecResult> {
  return withTemp(async (dir) => {
    const match = code.match(/public\s+class\s+(\w+)/)
    const cls = match?.[1] ?? "Main"
    const src = join(dir, `${cls}.java`)
    await writeFile(src, code, "utf8")
    const compile = await runProc("javac", [src], { cwd: dir })
    if (compile.exitCode !== 0) return { ...compile, stdout: "" }
    const run = await runProc("java", ["-cp", dir, cls], { cwd: dir })
    return {
      stdout: run.stdout,
      stderr: (compile.stderr + (run.stderr ? "\n" + run.stderr : "")).trim(),
      exitCode: run.exitCode,
      executionTime: compile.executionTime + run.executionTime,
    }
  })
}

export async function executeRust(code: string): Promise<ExecResult> {
  return withTemp(async (dir) => {
    const src = join(dir, "main.rs")
    const bin = join(dir, "main_out")
    await writeFile(src, code, "utf8")
    const compile = await runProc("rustc", [src, "-o", bin], { cwd: dir })
    if (compile.exitCode !== 0) return { ...compile, stdout: "" }
    const run = await runProc(bin, [], { cwd: dir })
    return {
      stdout: run.stdout,
      stderr: (compile.stderr + (run.stderr ? "\n" + run.stderr : "")).trim(),
      exitCode: run.exitCode,
      executionTime: compile.executionTime + run.executionTime,
    }
  })
}

export async function executeGo(code: string): Promise<ExecResult> {
  return withTemp(async (dir) => {
    await writeFile(join(dir, "main.go"), code, "utf8")
    return runProc("go", ["run", join(dir, "main.go")], { cwd: dir })
  })
}

export async function executeShell(command: string, cwd: string): Promise<ExecResult> {
  let safeCwd = cwd
  try { await stat(cwd) } catch { safeCwd = tmpdir() }
  return runProc("bash", ["-c", command], { cwd: safeCwd })
}

export async function checkRuntime(runtime: string): Promise<boolean> {
  try {
    const r = await runProc(runtime, ["--version"], { timeout: 3000 })
    return r.exitCode === 0
  } catch {
    return false
  }
}

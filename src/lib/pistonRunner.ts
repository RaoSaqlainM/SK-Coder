type RunResult = {
  output: string
  stderr: string
  exitCode: number
  error?: string
}

type WandboxResponse = {
  status?: string | number
  program_output?: string
  program_error?: string
  compiler_output?: string
  compiler_error?: string
  signal?: string
}

type PistonResponse = {
  language?: string
  version?: string
  compile?: { stdout?: string; stderr?: string; code?: number | null; signal?: string | null }
  run?: { stdout?: string; stderr?: string; code?: number | null; signal?: string | null }
}

const WANDBOX_URL = "https://wandbox.org/api/compile.json"
const PISTON_URL = "https://emkc.org/api/v2/piston"

type LangConfig = { compiler: string; filename: string; options?: string; pistonLanguage: string; pistonVersion: string }

const LANG_CONFIGS: Record<string, LangConfig> = {
  cpp:        { compiler: "gcc-head",        filename: "prog.cpp",   pistonLanguage: "cpp",        pistonVersion: "10.2.0" },
  c:          { compiler: "gcc-head",        filename: "prog.c",    options: "-x c -std=c17", pistonLanguage: "c", pistonVersion: "10.2.0" },
  java:       { compiler: "openjdk-head",    filename: "Main.java", pistonLanguage: "java",      pistonVersion: "15.0.2" },
  kotlin:     { compiler: "kotlin-head",     filename: "Main.kt",   pistonLanguage: "kotlin",    pistonVersion: "1.6.10" },
  rust:       { compiler: "rust-head",       filename: "prog.rs",   pistonLanguage: "rust",      pistonVersion: "1.56.0" },
  go:         { compiler: "go-head",         filename: "prog.go",   pistonLanguage: "go",        pistonVersion: "1.16.2" },
  ruby:       { compiler: "ruby-head",       filename: "prog.rb",   pistonLanguage: "ruby",      pistonVersion: "3.0.1" },
  php:        { compiler: "php-head",        filename: "prog.php",  pistonLanguage: "php",       pistonVersion: "8.2.3" },
  swift:      { compiler: "swift-head",      filename: "prog.swift", pistonLanguage: "swift",   pistonVersion: "5.5.2" },
  python:     { compiler: "cpython-head",    filename: "prog.py",   pistonLanguage: "python",    pistonVersion: "3.10.0" },
  javascript: { compiler: "nodejs-head",     filename: "prog.js",   pistonLanguage: "javascript", pistonVersion: "18.15.0" },
  typescript: { compiler: "typescript-head", filename: "prog.ts",   pistonLanguage: "typescript", pistonVersion: "5.0.3" },
  bash:       { compiler: "bash",            filename: "prog.sh",   pistonLanguage: "bash",      pistonVersion: "5.2.0" },
  r:          { compiler: "r-head",          filename: "prog.r",    pistonLanguage: "r",         pistonVersion: "4.1.1" },
}

const JAVA_FALLBACKS = ["openjdk-head", "java-head", "java-openjdk-17.0.2", "openjdk-jdk-20+36"]
let _javaCompiler: string | null = null

async function runWandbox(compiler: string, code: string, filename: string, options?: string, stdin = ""): Promise<WandboxResponse | null> {
  const body: Record<string, string> = { compiler, code, filename }
  if (options) body["compiler-option-raw"] = options
  if (stdin) body.stdin = stdin
  const res = await fetch(WANDBOX_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) return null
  return res.json() as Promise<WandboxResponse>
}

async function resolveJavaCompiler(code: string, filename: string): Promise<RunResult> {
  if (_javaCompiler) {
    const data = await runWandbox(_javaCompiler, code, filename)
    if (data) return extractResult(data)
  }
  for (const compiler of JAVA_FALLBACKS) {
    try {
      const data = await runWandbox(compiler, code, filename)
      if (data && !String(data.status ?? "").includes("error")) {
        _javaCompiler = compiler
        return extractResult(data)
      }
    } catch { /* try next */ }
  }
  return { output: "", stderr: "Java compiler not found on Wandbox. Check https://wandbox.org for available Java compilers.", exitCode: 1 }
}

function extractResult(data: WandboxResponse): RunResult {
  const programOut = (data.program_output ?? "").trimEnd()
  const programErr = (data.program_error ?? "").trimEnd()
  const compileErr = (data.compiler_error ?? "").trimEnd()
  const rawStatus = data.status
  const parsedStatus = typeof rawStatus === "number" ? rawStatus : Number(rawStatus)
  const exitCode = Number.isFinite(parsedStatus)
    ? parsedStatus
    : (programErr || compileErr || data.signal ? 1 : 0)
  return {
    output: programOut,
    stderr: [programErr, compileErr].filter(Boolean).join("\n"),
    exitCode,
  }
}

function extractPistonResult(data: PistonResponse): RunResult {
  const compile = data.compile
  const run = data.run
  const compileStdout = compile?.stdout?.trimEnd() || ""
  const compileStderr = [compile?.stderr?.trimEnd(), compile?.signal ? `Compiler signal: ${compile.signal}` : ""].filter(Boolean).join("\n")
  const output = [compileStdout, run?.stdout?.trimEnd() || ""].filter(Boolean).join("\n")
  const stderr = [compileStderr, run?.stderr?.trimEnd(), run?.signal ? `Process signal: ${run.signal}` : ""].filter(Boolean).join("\n")
  const exitCode = compile?.code != null && compile.code !== 0
    ? compile.code
    : run?.code ?? (stderr ? 1 : 0)
  return { output, stderr, exitCode }
}

async function runOnPiston(cfg: LangConfig, code: string, stdin: string, serverUrl: string): Promise<RunResult | null> {
  try {
    const res = await fetch(`${serverUrl.replace(/\/$/, "")}/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language: cfg.pistonLanguage,
        version: cfg.pistonVersion,
        files: [{ name: cfg.filename, content: code }],
        stdin,
        args: [],
        compile_timeout: 10000,
        run_timeout: 10000,
        run_memory_limit: 256000000,
      }),
      signal: AbortSignal.timeout(30000),
    })
    if (!res.ok) return null
    return extractPistonResult(await res.json() as PistonResponse)
  } catch {
    return null
  }
}

export async function runWithPiston(code: string, language: string, serverUrl = PISTON_URL, stdin = ""): Promise<RunResult> {
  const cfg = LANG_CONFIGS[language]
  if (!cfg) {
    return { output: "", stderr: `Language "${language}" is not supported. Supported: ${Object.keys(LANG_CONFIGS).join(", ")}`, exitCode: 1, error: "unsupported" }
  }

  try {
    const pistonResult = await runOnPiston(cfg, code, stdin, serverUrl)
    if (pistonResult) return pistonResult

    if (language === "java") {
      return resolveJavaCompiler(code, cfg.filename)
    }

    const data = await runWandbox(cfg.compiler, code, cfg.filename, cfg.options, stdin)
    if (!data) {
      return { output: "", stderr: `No public runner responded. Piston and Wandbox are unavailable; check your internet connection and try again.`, exitCode: 1, error: "network" }
    }
    return extractResult(data)
  } catch (e) {
    return { output: "", stderr: `Public runner network error: ${String(e)}. Check your internet connection.`, exitCode: 1, error: "network" }
  }
}

export function getAvailableLanguages() {
  return Object.keys(LANG_CONFIGS)
}

export function detectLanguageFromExtension(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || ""
  const extMap: Record<string, string> = {
    cpp: "cpp", cc: "cpp", cxx: "cpp", c: "c", h: "c",
    java: "java", kt: "kotlin", rs: "rust", go: "go",
    rb: "ruby", php: "php", swift: "swift", r: "r",
    sh: "bash", bash: "bash", py: "python",
    js: "javascript", ts: "typescript",
  }
  return extMap[ext] || ""
}

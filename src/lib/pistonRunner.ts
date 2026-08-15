export type RunResult = {
  output: string
  stderr: string
  exitCode: number
  error?: string
  provider?: "piston" | "wandbox"
  unavailable?: boolean
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

type Runtime = { language: string; version: string; aliases?: string[]; runtime?: string }
type WandboxCompiler = { name: string; language: string }

const WANDBOX_URL = "https://wandbox.org/api/compile.json"
const WANDBOX_COMPILERS_URL = "https://wandbox.org/api/list.json"
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

const runtimeCache = new Map<string, Runtime | null>()
const compilerCache = new Map<string, string | null>()

function unavailableOutput(value: string) {
  return /catatonit|failed to exec pid1|container|gateway|service unavailable|internal server error|network error|timed out|runtime unavailable/i.test(value)
}

function matchesRuntime(runtime: Runtime, language: string) {
  const values = [runtime.language, ...(runtime.aliases ?? [])].map((value) => value.toLowerCase())
  if (language === "javascript") return runtime.runtime === "node" && values.some((value) => ["javascript", "js", "node", "node-js", "node-javascript"].includes(value))
  if (language === "cpp") return values.some((value) => ["cpp", "c++"].includes(value))
  return values.includes(language)
}

async function resolvePistonRuntime(language: string, serverUrl: string): Promise<Runtime | null> {
  const base = serverUrl.replace(/\/$/, "")
  const cacheKey = `${base}:${language}`
  if (runtimeCache.has(cacheKey)) return runtimeCache.get(cacheKey) ?? null
  try {
    const response = await fetch(`${base}/runtimes`, { signal: AbortSignal.timeout(8000) })
    if (!response.ok) throw new Error("Runtime catalog unavailable")
    const runtimes = await response.json() as Runtime[]
    const runtime = runtimes.find((item) => matchesRuntime(item, language)) ?? null
    runtimeCache.set(cacheKey, runtime)
    return runtime
  } catch {
    runtimeCache.set(cacheKey, null)
    return null
  }
}

function matchesCompiler(compiler: WandboxCompiler, language: string) {
  const current = compiler.language.toLowerCase()
  if (language === "javascript") return current.includes("javascript") || current.includes("node")
  if (language === "cpp") return current.includes("c++") || current.includes("cpp")
  return current.includes(language)
}

async function resolveWandboxCompiler(language: string): Promise<string | null> {
  if (compilerCache.has(language)) return compilerCache.get(language) ?? null
  try {
    const response = await fetch(WANDBOX_COMPILERS_URL, { signal: AbortSignal.timeout(8000) })
    if (!response.ok) throw new Error("Compiler catalog unavailable")
    const compilers = await response.json() as WandboxCompiler[]
    const candidates = compilers.filter((item) => matchesCompiler(item, language))
    const compiler = candidates.find((item) => !/head|experimental/i.test(item.name))?.name ?? candidates[0]?.name ?? null
    compilerCache.set(language, compiler)
    return compiler
  } catch {
    compilerCache.set(language, null)
    return null
  }
}

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
  const compiler = await resolveWandboxCompiler("java")
  if (!compiler) return { output: "", stderr: "No Java single-file fallback is available.", exitCode: 1, unavailable: true, error: "provider-unavailable" }
  const data = await runWandbox(compiler, code, filename)
  if (!data) return { output: "", stderr: "Wandbox could not be reached.", exitCode: 1, unavailable: true, error: "provider-unavailable" }
  return extractResult(data)
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
    provider: "wandbox",
    unavailable: exitCode !== 0 && unavailableOutput([programErr, compileErr].join("\n")),
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
  return { output, stderr, exitCode, provider: "piston", unavailable: exitCode !== 0 && unavailableOutput(stderr) }
}

async function runOnPiston(cfg: LangConfig, language: string, code: string, stdin: string, serverUrl: string): Promise<RunResult | null> {
  const runtime = await resolvePistonRuntime(language, serverUrl)
  if (!runtime) return null
  try {
    const res = await fetch(`${serverUrl.replace(/\/$/, "")}/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language: runtime.language,
        version: runtime.version,
        files: [{ name: cfg.filename, content: code }],
        stdin,
        args: [],
        compile_timeout: 10000,
        run_timeout: 10000,
        run_memory_limit: 256000000,
      }),
      signal: AbortSignal.timeout(30000),
    })
    if (!res.ok) return { output: "", stderr: `Piston request failed with ${res.status}.`, exitCode: 1, provider: "piston", unavailable: true, error: "provider-unavailable" }
    return extractPistonResult(await res.json() as PistonResponse)
  } catch {
    return { output: "", stderr: "Piston could not be reached.", exitCode: 1, provider: "piston", unavailable: true, error: "provider-unavailable" }
  }
}

export async function runWithPiston(code: string, language: string, serverUrl = PISTON_URL, stdin = ""): Promise<RunResult> {
  const cfg = LANG_CONFIGS[language]
  if (!cfg) {
    return { output: "", stderr: `Language "${language}" is not supported. Supported: ${Object.keys(LANG_CONFIGS).join(", ")}`, exitCode: 1, error: "unsupported" }
  }

  try {
    const pistonResult = await runOnPiston(cfg, language, code, stdin, serverUrl)
    if (pistonResult && !pistonResult.unavailable) return pistonResult

    if (language === "java") {
      return resolveJavaCompiler(code, cfg.filename)
    }

    const compiler = await resolveWandboxCompiler(language)
    const data = compiler ? await runWandbox(compiler, code, cfg.filename, cfg.options, stdin) : null
    if (!data) {
      return { output: "", stderr: pistonResult?.stderr || "No public single-file execution provider is available.", exitCode: 1, unavailable: true, error: "provider-unavailable" }
    }
    const result = extractResult(data)
    return result.unavailable ? { output: "", stderr: [pistonResult?.stderr, result.stderr].filter(Boolean).join("\n"), exitCode: 1, unavailable: true, error: "provider-unavailable" } : result
  } catch {
    return { output: "", stderr: "No public single-file execution provider is available.", exitCode: 1, unavailable: true, error: "provider-unavailable" }
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

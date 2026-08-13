import type { CloudResult } from "@/lib/pistonRunner"

type WandboxResponse = {
  status?: string
  signal?: string
  compiler_output?: string
  compiler_error?: string
  compiler_message?: string
  program_output?: string
  program_error?: string
  program_message?: string
}

const compilers: Record<string, string> = {
  js: "nodejs-20.17.0",
  mjs: "nodejs-20.17.0",
  cjs: "nodejs-20.17.0",
  java: "openjdk-jdk-21+35"
}

export function supportsWandbox(ext: string) {
  return Boolean(compilers[ext.toLowerCase()])
}

function sourceForCompiler(ext: string, source: string) {
  if (ext.toLowerCase() !== "java") return source
  return source.replace(/public\s+(?:(?:abstract|final)\s+)?class\s+[A-Za-z_$][\w$]*/, (declaration) => declaration.replace(/class\s+[A-Za-z_$][\w$]*/, "class prog"))
}

export async function runViaWandbox(ext: string, source: string, stdin = ""): Promise<CloudResult> {
  const compiler = compilers[ext.toLowerCase()]
  if (!compiler) return { ok: false, message: `No Wandbox runtime is configured for .${ext}.` }
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 25000)
  try {
    const response = await fetch("https://wandbox.org/api/compile.json", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ compiler, code: sourceForCompiler(ext, source), stdin }),
      signal: controller.signal
    })
    const body = await response.json() as WandboxResponse
    if (!response.ok) return { ok: false, offline: response.status >= 500, message: body.compiler_message || body.program_message || "Wandbox execution is unavailable." }
    const code = Number(body.status ?? "1")
    return {
      ok: code === 0,
      code,
      stdout: body.program_output,
      stderr: body.program_error,
      compileStderr: body.compiler_error,
      message: code === 0 ? undefined : body.compiler_message || body.program_message || body.signal || "Wandbox could not run this source."
    }
  } catch {
    return { ok: false, offline: true, message: "Wandbox execution is unavailable." }
  } finally {
    window.clearTimeout(timeout)
  }
}

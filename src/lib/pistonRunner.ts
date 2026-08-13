export type CloudResult = { ok: boolean; code?: number; stdout?: string; stderr?: string; compileStderr?: string; offline?: boolean; message?: string; diagnostics?: { filePath: string; lineNumber: number; columnNumber?: number; message: string; sourceLine?: string }[] }

const runtimes: Record<string, { language: string; version: string }> = { cpp: { language: "c++", version: "10.2.0" }, c: { language: "c", version: "10.2.0" }, java: { language: "java", version: "15.0.2" }, bash: { language: "bash", version: "5.2.0" }, sh: { language: "bash", version: "5.2.0" }, rs: { language: "rust", version: "1.68.2" }, go: { language: "go", version: "1.16.2" }, php: { language: "php", version: "8.2.3" } }
export function langForExt(ext: string) { return runtimes[ext.toLowerCase()]?.language }
export async function runViaPiston(ext: string, source: string, stdin = "", filePath = "main") : Promise<CloudResult> {
  const runtime = runtimes[ext.toLowerCase()]
  if (!runtime) return { ok: false, message: `No cloud compiler is configured for .${ext}.` }
  try {
    const response = await fetch("https://emkc.org/api/v2/piston/execute", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ language: runtime.language, version: runtime.version, files: [{ name: filePath, content: source }], stdin }) })
    if (!response.ok) return { ok: false, message: "Cloud execution is unavailable.", offline: true }
    const body = await response.json() as { run?: { code?: number; output?: string; stderr?: string }; compile?: { stderr?: string } }
    return { ok: body.run?.code === 0, code: body.run?.code, stdout: body.run?.output, stderr: body.run?.stderr, compileStderr: body.compile?.stderr }
  } catch { return { ok: false, offline: true, message: "Cloud execution is unavailable. Try again when online." } }
}

type RunResult = {
  output: string[]
  error: string | null
}

export function runJavaScript(code: string): RunResult {
  const output: string[] = []
  const errors: string[] = []

  const originalLog = console.log
  const originalError = console.error
  const originalWarn = console.warn
  const originalInfo = console.info

  try {
    console.log = (...args: unknown[]) => {
      output.push(args.map(formatValue).join(" "))
    }
    console.error = (...args: unknown[]) => {
      errors.push(args.map(formatValue).join(" "))
    }
    console.warn = (...args: unknown[]) => {
      output.push("[warn] " + args.map(formatValue).join(" "))
    }
    console.info = (...args: unknown[]) => {
      output.push("[info] " + args.map(formatValue).join(" "))
    }

    const result = new Function(code)()
    if (result !== undefined) {
      output.push("→ " + formatValue(result))
    }
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e))
  } finally {
    console.log = originalLog
    console.error = originalError
    console.warn = originalWarn
    console.info = originalInfo
  }

  return {
    output,
    error: errors.length > 0 ? errors.join("\n") : null,
  }
}

function formatValue(v: unknown): string {
  if (v === null) return "null"
  if (v === undefined) return "undefined"
  if (typeof v === "string") return v
  if (typeof v === "number" || typeof v === "boolean") return String(v)
  if (v instanceof Error) return v.stack || v.message
  try {
    return JSON.stringify(v, null, 2)
  } catch {
    return String(v)
  }
}

export function runNodeSimulated(code: string): RunResult {
  const builtins = `
    const require = (mod) => {
      const mocks = {
        'path': { join: (...a) => a.join('/'), resolve: (...a) => '/' + a.join('/'), basename: (p) => p.split('/').pop(), extname: (p) => { const i = p.lastIndexOf('.'); return i === -1 ? '' : p.slice(i) } },
        'os': { platform: () => 'linux', homedir: () => '/home/user', tmpdir: () => '/tmp', cpus: () => [{ model: 'Virtual CPU' }] },
        'fs': { existsSync: () => false, readFileSync: () => '', writeFileSync: () => {}, readdirSync: () => [] },
        'crypto': { randomUUID: () => Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2) },
      }
      if (mocks[mod]) return mocks[mod]
      throw new Error('require("' + mod + '") is not available in the browser environment. Install and import as an ES module instead.')
    }
    const process = { env: {}, argv: ['node'], exit: (code) => { throw new Error('process.exit(' + code + ')') }, cwd: () => '/', platform: 'linux', version: 'v18.0.0' }
    const __dirname = '/'
    const __filename = '/index.js'
    const Buffer = { from: (s, enc) => ({ toString: () => s }), isBuffer: () => false }
  `
  return runJavaScript(builtins + "\n" + code)
}

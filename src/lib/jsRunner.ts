export async function runJS(source: string, output: (text: string, type?: "output" | "error") => void) {
  const logs: string[] = []
  const capture = (...args: unknown[]) => logs.push(args.map((value) => typeof value === "string" ? value : JSON.stringify(value)).join(" "))
  try {
    const fn = new Function("console", `"use strict"; return (async () => { ${source}\n })();`)
    await fn({ log: capture, warn: capture, error: (...args: unknown[]) => output(args.map(String).join(" "), "error") })
    logs.forEach((line) => output(line, "output"))
  } catch (error) { output(error instanceof Error ? error.message : String(error), "error") }
}

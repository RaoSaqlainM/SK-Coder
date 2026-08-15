import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/wandboxRunner", () => ({ runViaWandbox: vi.fn() }))
vi.mock("@/lib/jsRunner", () => ({ runJS: vi.fn() }))
vi.mock("@/lib/pyodideRunner", () => ({ runPython: vi.fn() }))
vi.mock("@/lib/pistonRunner", () => ({ runViaPiston: vi.fn() }))

import { runWorkspace } from "@/lib/runWorkspace"
import { runJS } from "@/lib/jsRunner"
import { runPython } from "@/lib/pyodideRunner"
import { runViaWandbox } from "@/lib/wandboxRunner"

function optionsFor(name: string, content: string) {
  const lines: Array<{ text: string; type: string }> = []
  const terminalTypes: string[] = []
  return {
    lines,
    terminalTypes,
    options: {
      activeTab: { name, path: `/${name}`, language: name.endsWith(".py") ? "python" : "javascript", content },
      fileTree: [],
      addTerminalLine: (line: { text: string; type: "input" | "output" | "error" | "info" | "success" }) => lines.push(line),
      setPreviewUrl: vi.fn(),
      setActivePanel: vi.fn(),
      setTerminalType: (type: string) => terminalTypes.push(type),
    },
  }
}

describe("workspace execution fallbacks", () => {
  it("runs a standalone Node.js file in the browser when Wandbox is unavailable", async () => {
    vi.mocked(runViaWandbox).mockResolvedValue({ ok: false, offline: true, code: 1, stdout: "", stderr: "", compileStderr: "" })
    vi.mocked(runJS).mockImplementation(async (_code, emit) => emit("browser fallback output"))
    const target = optionsFor("demo.js", "console.log('browser fallback output')")

    await runWorkspace(target.options)

    expect(target.terminalTypes).toEqual(["node"])
    expect(vi.mocked(runJS)).toHaveBeenCalledOnce()
    expect(target.lines).toContainEqual({ text: "Wandbox is unavailable. Running this standalone script in the browser.", type: "info" })
    expect(target.lines).toContainEqual({ text: "browser fallback output", type: "output" })
  })

  it("uses browser Python without requiring a backend execution service", async () => {
    vi.mocked(runPython).mockImplementation(async (_code, emit) => emit("python browser output"))
    const target = optionsFor("demo.py", "print('python browser output')")

    await runWorkspace(target.options)

    expect(target.terminalTypes).toEqual(["python"])
    expect(vi.mocked(runPython)).toHaveBeenCalledOnce()
    expect(target.lines).toContainEqual({ text: "python browser output", type: "output" })
  })
})

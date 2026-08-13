import { afterEach, describe, expect, it, vi } from "vitest"
import { runViaWandbox, supportsWandbox } from "@/lib/wandboxRunner"

describe("Wandbox runner", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("declares Node.js and Java as primary Wandbox runtimes", () => {
    expect(supportsWandbox("js")).toBe(true)
    expect(supportsWandbox("java")).toBe(true)
    expect(supportsWandbox("rust")).toBe(false)
  })

  it("normalizes a Java public entry class for Wandbox and returns program output", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: "0", program_output: "42\n" }) })
    vi.stubGlobal("fetch", fetchMock)
    const result = await runViaWandbox("java", "public class Main { public static void main(String[] args) { System.out.println(42); } }")
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(payload.compiler).toBe("openjdk-jdk-21+35")
    expect(payload.code).toContain("public class prog")
    expect(result).toMatchObject({ ok: true, code: 0, stdout: "42\n" })
  })
})

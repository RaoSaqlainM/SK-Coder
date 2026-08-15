import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { clearStoredKey, getBaseUrl, getModel, getStoredKey, validateKey } from "@/lib/aiClient"

describe("AI key validation", () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal("fetch", vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("persists a key, normalized endpoint, and model only after a successful validation", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("{}", { status: 200 }))
    const result = await validateKey("test-key", "https://example.test/v1/", "test-model")
    expect(result.ok).toBe(true)
    expect(getStoredKey()).toBe("test-key")
    expect(getBaseUrl()).toBe("https://example.test/v1")
    expect(getModel()).toBe("test-model")
    clearStoredKey()
    expect(getStoredKey()).toBe("")
  })

  it("does not persist a key when the configured endpoint rejects validation", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("unauthorized", { status: 401 }))
    const result = await validateKey("bad-key", "https://example.test/v1", "test-model")
    expect(result.ok).toBe(false)
    expect(getStoredKey()).toBe("")
  })
})

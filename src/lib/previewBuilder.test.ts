import { describe, expect, it } from "vitest"
import { buildHtmlPreview } from "@/lib/previewBuilder"

describe("preview builder", () => {
  it("injects runtime error forwarding before workspace scripts execute", () => {
    const html = buildHtmlPreview({ id: "index", name: "index.html", path: "/index.html", type: "file", content: "<!doctype html><html><head></head><body><main>Preview</main></body></html>" }, [{ id: "script", name: "app.js", path: "/app.js", type: "file", content: "throw new Error('broken')" }])
    expect(html).toContain("sk-coder-preview")
    expect(html.indexOf("sk-coder-preview")).toBeLessThan(html.indexOf("throw new Error"))
  })

  it("inlines imported binary assets referenced by an HTML workspace file", () => {
    const html = buildHtmlPreview({ id: "index", name: "index.html", path: "/index.html", type: "file", content: "<img src=\"assets/logo.png\">" }, [{ id: "asset", name: "logo.png", path: "/assets/logo.png", type: "file", content: "AA==", encoding: "base64", mimeType: "image/png" }])
    expect(html).toContain("data:image/png;base64,AA==")
  })
})

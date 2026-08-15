import { describe, expect, it } from "vitest"
import { mergeFileTrees } from "@/lib/importProject"
import type { FileNode } from "@/types/ide"

describe("workspace import merging", () => {
  const current: FileNode[] = [{ id: "folder", name: "src", type: "folder", path: "/src", children: [{ id: "old", name: "main.js", type: "file", path: "/src/main.js", content: "old" }] }]
  const incoming: FileNode[] = [{ id: "next-folder", name: "src", type: "folder", path: "/src", children: [{ id: "next", name: "main.js", type: "file", path: "/src/main.js", content: "new" }, { id: "asset", name: "logo.png", type: "file", path: "/src/logo.png", content: "AA==", encoding: "base64", mimeType: "image/png" }] }]

  it("replaces an entire workspace when requested", () => {
    const result = mergeFileTrees(current, incoming, "replace")
    expect(result.conflicts).toBe(0)
    expect(result.tree[0].children?.[0].content).toBe("new")
  })

  it("merges incoming files and reports overwritten paths", () => {
    const result = mergeFileTrees(current, incoming, "merge")
    expect(result.conflicts).toBe(1)
    expect(result.tree[0].children?.map((node) => node.name)).toEqual(["main.js", "logo.png"])
    expect(result.tree[0].children?.[0].content).toBe("new")
  })
})

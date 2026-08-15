import { describe, expect, it } from "vitest"
import { buildRemoteFileTree, flattenWorkspaceFiles } from "@/lib/githubGit"

describe("GitHub workspace tree transforms", () => {
  it("builds nested repository files and preserves binary response encoding", () => {
    const tree = buildRemoteFileTree([
      { path: "src/index.ts", content: "export const value = 42" },
      { path: "assets/logo.png", content: "AA==" },
    ])
    const files = flattenWorkspaceFiles(tree)
    expect(files.map((file) => file.path)).toEqual(["/assets/logo.png", "/src/index.ts"])
    expect(files.find((file) => file.path === "/assets/logo.png")?.encoding).toBe("base64")
  })
})

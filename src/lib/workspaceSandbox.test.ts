import { beforeEach, describe, expect, it } from "vitest"
import { runSandboxCommand, type WorkspaceSandboxActions } from "@/lib/workspaceSandbox"
import { useIDEStore } from "@/store/ideStore"

function resetStore() {
  localStorage.clear()
  useIDEStore.setState(useIDEStore.getInitialState(), true)
}

function actions(): WorkspaceSandboxActions {
  const store = useIDEStore.getState()
  return {
    addFile: store.addFile,
    deleteFileNode: store.deleteFileNode,
    renameNode: store.renameNode,
    moveNode: store.moveNode,
    setFileTree: store.setFileTree,
  }
}

describe("browser workspace sandbox", () => {
  beforeEach(resetStore)

  it("mutates the file tree and resolves paths without a server runtime", async () => {
    const store = useIDEStore.getState()
    store.addFile("", "src", "folder")
    store.addFile("/src", "readme.txt", "file", "hello SK Coder\nsecond line")
    store.addFile("", "docs", "folder")
    const lines: string[] = []
    let cwd = "/"
    const execute = async (command: string, ...args: string[]) => {
      const result = await runSandboxCommand(command, args, useIDEStore.getState().fileTree, (text) => lines.push(text), () => undefined, { cwd, actions: actions() })
      cwd = result.cwd
    }

    await execute("mkdir", "scratch")
    await execute("cd", "scratch")
    await execute("pwd")
    await execute("cd", "..")
    await execute("cp", "src/readme.txt", "docs")
    await execute("mv", "docs/readme.txt", "docs/guide.txt")
    await execute("grep", "hello", "docs/guide.txt")
    await execute("find", "guide")
    await execute("rm", "scratch")

    const tree = useIDEStore.getState().fileTree
    expect(cwd).toBe("/")
    expect(tree.some((node) => node.path === "/scratch")).toBe(false)
    expect(tree.find((node) => node.path === "/docs")?.children?.[0].path).toBe("/docs/guide.txt")
    expect(lines).toContain("/scratch")
    expect(lines).toContain("/docs/guide.txt:1:hello SK Coder")
    expect(lines).toContain("/docs/guide.txt")
  })
})

import { beforeEach, describe, expect, it } from "vitest"
import { useIDEStore } from "@/store/ideStore"

function resetStore() {
  localStorage.clear()
  useIDEStore.setState(useIDEStore.getInitialState(), true)
}

describe("IDE workspace state", () => {
  beforeEach(resetStore)

  it("creates nested files and keeps open tabs synchronized when a folder is renamed", () => {
    const store = useIDEStore.getState()
    store.addFile("", "src", "folder")
    store.addFile("/src", "main.js", "file", "console.log(42)")
    store.renameNode("/src", "app")
    const state = useIDEStore.getState()
    expect(state.fileTree[0].path).toBe("/app")
    expect(state.fileTree[0].children?.[0].path).toBe("/app/main.js")
    expect(state.openTabs[0].path).toBe("/app/main.js")
  })

  it("moves a nested workspace item and removes affected tabs when deleting its parent", () => {
    const store = useIDEStore.getState()
    store.addFile("", "src", "folder")
    store.addFile("", "lib", "folder")
    store.addFile("/src", "main.py", "file", "print(42)")
    store.moveNode("/src/main.py", "/lib")
    expect(useIDEStore.getState().openTabs[0].path).toBe("/lib/main.py")
    useIDEStore.getState().deleteFileNode("/lib")
    expect(useIDEStore.getState().openTabs).toHaveLength(0)
    expect(useIDEStore.getState().fileTree.some((node) => node.path === "/lib")).toBe(false)
  })

  it("refreshes preview state when autosaving a file update", () => {
    const store = useIDEStore.getState()
    store.addFile("", "index.html", "file", "<main>before</main>")
    const before = useIDEStore.getState().previewKey
    store.updateFileContent("/index.html", "<main>after</main>")
    const state = useIDEStore.getState()
    expect(state.fileTree[0].content).toBe("<main>after</main>")
    expect(state.previewKey).toBe(before + 1)
  })
})

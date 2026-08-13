import test from "node:test"
import assert from "node:assert/strict"
import { resolveRuntime, sourceForRuntime } from "../src/runtimes.js"

test("resolves supported runtime aliases", () => {
  assert.equal(resolveRuntime("py")?.id, "python")
  assert.equal(resolveRuntime("mjs")?.id, "node")
  assert.equal(resolveRuntime("c++")?.id, "cpp")
  assert.equal(resolveRuntime("rs")?.id, "rust")
})

test("normalizes a Java public entry class to the configured source filename", () => {
  const source = "public class Playground { public static void main(String[] args) {} }"
  assert.equal(sourceForRuntime(resolveRuntime("java"), source), "public class Main { public static void main(String[] args) {} }")
})

test("preserves source for non-Java runtimes", () => {
  const source = "console.log('kept')"
  assert.equal(sourceForRuntime(resolveRuntime("node"), source), source)
})

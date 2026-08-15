import { Router } from "express"
import {
  executePython, executeNode, executeCpp, executeJava,
  executeRust, executeGo, executeShell, checkRuntime,
} from "../lib/executor"

const router = Router()

router.post("/execute", async (req, res) => {
  const { language, code, cwd } = req.body as { language: string; code: string; cwd?: string }

  if (!language || code === undefined || code === null) {
    res.status(400).json({ error: "language and code are required" })
    return
  }

  const trimmed = String(code)
  if (!trimmed.trim()) {
    res.json({ stdout: "", stderr: "", exitCode: 0, executionTime: 0 })
    return
  }

  try {
    let result
    switch (language.toLowerCase()) {
      case "python": case "python3": result = await executePython(trimmed); break
      case "node": case "nodejs": case "javascript": result = await executeNode(trimmed); break
      case "cpp": case "c++": result = await executeCpp(trimmed, "cpp"); break
      case "c": result = await executeCpp(trimmed, "c"); break
      case "java": result = await executeJava(trimmed); break
      case "rust": result = await executeRust(trimmed); break
      case "go": result = await executeGo(trimmed); break
      case "bash": case "shell": case "sh":
        result = await executeShell(trimmed, cwd || process.env["HOME"] || "/tmp")
        break
      default:
        res.status(400).json({ error: `Language '${language}' is not supported. Supported: python, node, cpp, c, java, rust, go, bash` })
        return
    }
    res.json(result)
  } catch (e) {
    res.status(500).json({ error: String(e), stdout: "", stderr: String(e), exitCode: 1, executionTime: 0 })
  }
})

router.get("/execute/runtimes", async (_req, res) => {
  const runtimes = await Promise.all([
    checkRuntime("python3").then((ok) => ({ name: "python3", available: ok })),
    checkRuntime("node").then((ok) => ({ name: "node", available: ok })),
    checkRuntime("gcc").then((ok) => ({ name: "gcc", available: ok })),
    checkRuntime("g++").then((ok) => ({ name: "g++", available: ok })),
    checkRuntime("javac").then((ok) => ({ name: "javac", available: ok })),
    checkRuntime("java").then((ok) => ({ name: "java", available: ok })),
    checkRuntime("rustc").then((ok) => ({ name: "rustc", available: ok })),
    checkRuntime("go").then((ok) => ({ name: "go", available: ok })),
  ])
  res.json({ runtimes })
})

export default router

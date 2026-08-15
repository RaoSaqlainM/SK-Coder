import { Router } from "express"
import { createWorkspaceSession, runCodeInWorkspace, runWorkspaceCommand, syncWorkspaceFiles, workspaceStatus } from "../lib/sessionManager"

const router = Router()

router.get("/runtimes", async (_req, res) => {
  const status = await workspaceStatus()
  res.json({ runtimes: ["node", "python", "bash", "java", "c", "cpp", "rust", "go"].map((name) => ({ name, available: status.ready })), status })
})

router.post("/sessions", async (_req, res) => {
  try {
    const session = await createWorkspaceSession()
    res.status(201).json({ id: session.id, cwd: "/", expiresInHours: 72 })
  } catch (error) {
    res.status(503).json({ error: error instanceof Error ? error.message : "Session service unavailable." })
  }
})

router.post("/sessions/:id/command", async (req, res) => {
  const { command, cwd } = req.body as { command?: string; cwd?: string }
  if (!command?.trim()) {
    res.status(400).json({ error: "command is required" })
    return
  }
  try {
    res.json(await runWorkspaceCommand(req.params.id, command, cwd || "/"))
  } catch (error) {
    res.status(400).json({ stdout: "", stderr: error instanceof Error ? error.message : "Command failed.", exitCode: 1, executionTime: 0, error: "command-failed" })
  }
})

router.post("/sessions/:id/files", async (req, res) => {
  const { files } = req.body as { files?: { path?: unknown; content?: unknown }[] }
  if (!Array.isArray(files)) {
    res.status(400).json({ error: "files must be an array" })
    return
  }
  try {
    await syncWorkspaceFiles(req.params.id, files.map((file) => ({ path: String(file.path ?? ""), content: String(file.content ?? "") })))
    res.status(204).end()
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Workspace synchronization failed." })
  }
})

router.post("/execute", async (req, res) => {
  const { language, code, sessionId } = req.body as { language?: string; code?: string; sessionId?: string }
  if (!language || code === undefined) {
    res.status(400).json({ error: "language and code are required" })
    return
  }
  try {
    const session = sessionId ? { id: sessionId } : await createWorkspaceSession()
    res.json({ ...(await runCodeInWorkspace(session.id, language, code)), sessionId: session.id })
  } catch (error) {
    res.status(503).json({ stdout: "", stderr: error instanceof Error ? error.message : "Execution service unavailable.", exitCode: 1, executionTime: 0, error: "runtime-unavailable" })
  }
})

export default router

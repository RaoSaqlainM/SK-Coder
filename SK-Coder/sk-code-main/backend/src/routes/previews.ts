import { Router } from "express";
import { createWebPreviewSession, getWebPreviewSessionStatus, launchWebPreviewSession, stopWebPreviewSession } from "../lib/webPreviewSessionManager.js";
import { proxyWebPreviewHttpRequest } from "../web-preview-proxy.js";
import { authorizeTerminalSession } from "../lib/sessionManager.js";

const router = Router();

function deviceId(req: any) {
    return typeof req.deviceId === "string" ? req.deviceId : "anonymous";
}

router.post("/previews/sessions", async (req, res) => {
    try {
        const workspaceSessionId = typeof req.body?.workspaceSessionId === "string" ? req.body.workspaceSessionId : undefined;
        if (workspaceSessionId && !(await authorizeTerminalSession(workspaceSessionId, req.header("x-sk-workspace-access")))) {
            res.status(403).json({ error: "Workspace access is not valid for this browser session." });
            return;
        }
        res.status(201).json(await createWebPreviewSession(deviceId(req), workspaceSessionId));
    }
    catch (error) {
        res.status(503).json({ error: error instanceof Error ? error.message : "Project preview is unavailable." });
    }
});

router.post("/previews/sessions/:id/launch", async (req, res) => {
    const projectPath = typeof req.body?.projectPath === "string" ? req.body.projectPath : "";
    if (!projectPath)
        return res.status(400).json({ error: "A project folder is required." });
    try {
        res.json(await launchWebPreviewSession(req.params.id, deviceId(req), req.header("x-sk-workspace-access"), projectPath));
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Project preview could not start." });
    }
});

router.get("/previews/sessions/:id", async (req, res) => {
    try {
        res.json(await getWebPreviewSessionStatus(req.params.id, deviceId(req), req.header("x-sk-workspace-access")));
    }
    catch (error) {
        res.status(404).json({ error: error instanceof Error ? error.message : "Project preview session not found." });
    }
});

router.delete("/previews/sessions/:id", async (req, res) => {
    try {
        await stopWebPreviewSession(req.params.id, deviceId(req), req.header("x-sk-workspace-access"));
        res.status(204).end();
    }
    catch (error) {
        res.status(404).json({ error: error instanceof Error ? error.message : "Project preview session not found." });
    }
});

router.use("/previews/sessions/:id/view/:token", (req, res) => proxyWebPreviewHttpRequest(req, res, req.params.id, req.params.token));

export default router;

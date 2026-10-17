import { Router } from "express";
import { createGuiSession, getGuiSessionStatus, launchGuiSession, stopGuiSession } from "../lib/guiSessionManager.js";
import { proxyGuiHttpRequest } from "../gui-proxy.js";
import { authorizeTerminalSession } from "../lib/sessionManager.js";

const router = Router();

function deviceId(req: any) {
    if (typeof req.deviceId !== "string" || req.deviceId === "anonymous")
        throw new Error("A browser workspace capability is required for graphical display sessions.");
    return req.deviceId;
}

router.post("/gui/sessions", async (req, res) => {
    try {
        const workspaceSessionId = typeof req.body?.workspaceSessionId === "string" ? req.body.workspaceSessionId : undefined;
        if (workspaceSessionId && !(await authorizeTerminalSession(workspaceSessionId, req.header("x-sk-workspace-access")))) {
            res.status(403).json({ error: "Workspace access is not valid for this browser session." });
            return;
        }
        res.status(201).json(await createGuiSession(deviceId(req), workspaceSessionId));
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Display service unavailable.";
        res.status(/capability/i.test(message) ? 401 : 503).json({ error: message });
    }
});

router.post("/gui/sessions/:id/launch", async (req, res) => {
    const filePath = typeof req.body?.filePath === "string" ? req.body.filePath : "";
    const language = typeof req.body?.language === "string" ? req.body.language : undefined;
    if (!filePath)
        return res.status(400).json({ error: "filePath is required." });
    try {
        res.json(await launchGuiSession(req.params.id, deviceId(req), req.header("x-sk-workspace-access"), filePath, language));
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Display launch failed.";
        res.status(/capability/i.test(message) ? 401 : 400).json({ error: message });
    }
});

router.get("/gui/sessions/:id", async (req, res) => {
    try {
        res.json(await getGuiSessionStatus(req.params.id, deviceId(req), req.header("x-sk-workspace-access")));
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Display session not found.";
        res.status(/capability/i.test(message) ? 401 : 404).json({ error: message });
    }
});

router.delete("/gui/sessions/:id", async (req, res) => {
    try {
        await stopGuiSession(req.params.id, deviceId(req), req.header("x-sk-workspace-access"));
        res.status(204).end();
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Display session not found.";
        res.status(/capability/i.test(message) ? 401 : 404).json({ error: message });
    }
});

router.use("/gui/sessions/:id/view/:token", (req, res) => proxyGuiHttpRequest(req, res, req.params.id, req.params.token));

export default router;

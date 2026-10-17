import { Router } from "express";
import { buildApkJob, createApkJob, getApkArtifact, getApkJobStatus, listDecodedEntries, readDecodedEntry, updateDecodedEntry } from "../lib/apkJobManager.js";

const router = Router();

router.post("/apk/jobs", async (req: any, res) => {
    const { workspaceSessionId, sourcePath, mode } = req.body || {};
    if (typeof workspaceSessionId !== "string" || typeof sourcePath !== "string" || !["inspect", "resources", "full"].includes(mode)) {
        res.status(400).json({ error: "workspaceSessionId, sourcePath, and a valid APK job mode are required." });
        return;
    }
    try {
        res.status(202).json(await createApkJob(req.deviceId, req.header("x-sk-workspace-access"), { workspaceSessionId, sourcePath, mode }));
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "APK job could not be created." });
    }
});

router.get("/apk/jobs/:id", async (req: any, res) => {
    try {
        res.json(await getApkJobStatus(req.params.id, req.deviceId, req.header("x-sk-workspace-access")));
    }
    catch (error) {
        res.status(404).json({ error: error instanceof Error ? error.message : "APK job not found." });
    }
});

router.get("/apk/jobs/:id/entries", async (req: any, res) => {
    try {
        res.json({ entries: await listDecodedEntries(req.params.id, req.deviceId, req.header("x-sk-workspace-access")) });
    }
    catch (error) {
        res.status(404).json({ error: error instanceof Error ? error.message : "Decoded APK workspace not found." });
    }
});

router.get("/apk/jobs/:id/entries/{*entryPath}", async (req: any, res) => {
    try {
        const entryPath = Array.isArray(req.params.entryPath) ? req.params.entryPath.join("/") : req.params.entryPath;
        if (typeof entryPath !== "string" || !entryPath) throw new Error("A decoded file path is required.");
        res.json(await readDecodedEntry(req.params.id, req.deviceId, req.header("x-sk-workspace-access"), entryPath));
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Decoded APK entry could not be read." });
    }
});

router.put("/apk/jobs/:id/entries/{*entryPath}", async (req: any, res) => {
    try {
        const entryPath = Array.isArray(req.params.entryPath) ? req.params.entryPath.join("/") : req.params.entryPath;
        if (typeof entryPath !== "string" || !entryPath || typeof req.body?.content !== "string") throw new Error("A decoded file path and text content are required.");
        res.json(await updateDecodedEntry(req.params.id, req.deviceId, req.header("x-sk-workspace-access"), entryPath, req.body.content));
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Decoded APK entry could not be saved." });
    }
});

router.post("/apk/jobs/:id/build", async (req: any, res) => {
    try {
        res.status(202).json(await buildApkJob(req.params.id, req.deviceId, req.header("x-sk-workspace-access"), typeof req.body?.outputName === "string" ? req.body.outputName : undefined, req.body?.sign === true));
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "APK build could not start." });
    }
});

router.get("/apk/jobs/:id/artifact", async (req: any, res) => {
    try {
        const artifact = await getApkArtifact(req.params.id, req.deviceId, req.header("x-sk-workspace-access"));
        res.download(artifact.path, artifact.name);
    }
    catch (error) {
        res.status(404).json({ error: error instanceof Error ? error.message : "APK artifact not found." });
    }
});

export default router;

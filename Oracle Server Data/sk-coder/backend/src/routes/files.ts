import { Router } from "express";
import fs from "fs";
import path from "path";
const router = Router();
const DATA_DIR = path.join(process.cwd(), "backend_data");
function projectPath(id: string) {
    return path.join(DATA_DIR, `${id}.json`);
}
function sanitizePath(filePath: string): string | null {
    if (!filePath)
        return null;
    const normalized = path.normalize(filePath);
    if (normalized.includes("..") || normalized.includes("\0"))
        return null;
    return normalized;
}
router.get("/files/:projectId", (req: any, res) => {
    const p = projectPath(req.params.projectId);
    if (!fs.existsSync(p))
        return res.status(404).json({ error: "project not found" });
    const data = JSON.parse(fs.readFileSync(p, "utf-8"));
    if (data.deviceId !== req.deviceId)
        return res.status(403).json({ error: "forbidden" });
    res.json(data.files || []);
});
router.get("/files/:projectId/file", (req: any, res) => {
    const p = projectPath(req.params.projectId);
    if (!fs.existsSync(p))
        return res.status(404).json({ error: "project not found" });
    const data = JSON.parse(fs.readFileSync(p, "utf-8"));
    if (data.deviceId !== req.deviceId)
        return res.status(403).json({ error: "forbidden" });
    const rawPath = String(req.query.path || "");
    const filePath = sanitizePath(rawPath);
    if (!filePath)
        return res.status(400).json({ error: "invalid path" });
    const file = (data.files || []).find((f: any) => f.path === filePath);
    if (!file)
        return res.status(404).json({ error: "file not found" });
    res.json(file);
});
router.post("/files/:projectId", (req: any, res) => {
    const p = projectPath(req.params.projectId);
    if (!fs.existsSync(p))
        return res.status(404).json({ error: "project not found" });
    const data = JSON.parse(fs.readFileSync(p, "utf-8"));
    if (data.deviceId !== req.deviceId)
        return res.status(403).json({ error: "forbidden" });
    const rawPath = req.body.path || req.body.name;
    const filePath = sanitizePath(rawPath);
    if (!filePath)
        return res.status(400).json({ error: "invalid path" });
    const file = {
        path: filePath,
        name: req.body.name || path.basename(filePath),
        type: req.body.type || "file",
        content: req.body.content || "",
    };
    data.files = data.files || [];
    data.files.push(file);
    fs.writeFileSync(p, JSON.stringify(data, null, 2));
    res.status(201).json(file);
});
router.put("/files/:projectId/file", (req: any, res) => {
    const p = projectPath(req.params.projectId);
    if (!fs.existsSync(p))
        return res.status(404).json({ error: "project not found" });
    const data = JSON.parse(fs.readFileSync(p, "utf-8"));
    if (data.deviceId !== req.deviceId)
        return res.status(403).json({ error: "forbidden" });
    const rawPath = String(req.query.path || "");
    const filePath = sanitizePath(rawPath);
    if (!filePath)
        return res.status(400).json({ error: "invalid path" });
    const idx = (data.files || []).findIndex((f: any) => f.path === filePath);
    if (idx === -1)
        return res.status(404).json({ error: "file not found" });
    data.files[idx] = { ...data.files[idx], ...req.body };
    fs.writeFileSync(p, JSON.stringify(data, null, 2));
    res.json(data.files[idx]);
});
router.delete("/files/:projectId/file", (req: any, res) => {
    const p = projectPath(req.params.projectId);
    if (!fs.existsSync(p))
        return res.status(404).json({ error: "project not found" });
    const data = JSON.parse(fs.readFileSync(p, "utf-8"));
    if (data.deviceId !== req.deviceId)
        return res.status(403).json({ error: "forbidden" });
    const rawPath = String(req.query.path || "");
    const filePath = sanitizePath(rawPath);
    if (!filePath)
        return res.status(400).json({ error: "invalid path" });
    data.files = (data.files || []).filter((f: any) => f.path !== filePath);
    fs.writeFileSync(p, JSON.stringify(data, null, 2));
    res.json({ ok: true });
});
export default router;

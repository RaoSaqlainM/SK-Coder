import { Router } from "express";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
const router = Router();
const DATA_DIR = path.join(process.cwd(), "backend_data");
if (!fs.existsSync(DATA_DIR))
    fs.mkdirSync(DATA_DIR, { recursive: true });
function projectPath(id: string) {
    return path.join(DATA_DIR, `${id}.json`);
}
function listProjects(deviceId: string) {
    const files = fs.readdirSync(DATA_DIR);
    return files
        .filter((f) => f.endsWith(".json"))
        .map((f) => JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), "utf-8")))
        .filter((p: any) => p.deviceId === deviceId);
}
router.get("/projects", (req: any, res) => {
    res.json(listProjects(req.deviceId));
});
router.post("/projects", (req: any, res) => {
    const id = randomUUID();
    const project = {
        id,
        name: req.body.name || `Project ${id.slice(0, 6)}`,
        files: [],
        deviceId: req.deviceId,
    };
    fs.writeFileSync(projectPath(id), JSON.stringify(project, null, 2));
    res.status(201).json(project);
});
router.get("/projects/:id", (req: any, res) => {
    const p = projectPath(req.params.id);
    if (!fs.existsSync(p))
        return res.status(404).json({ error: "not found" });
    const data = JSON.parse(fs.readFileSync(p, "utf-8"));
    if (data.deviceId !== req.deviceId)
        return res.status(403).json({ error: "forbidden" });
    res.json(data);
});
router.put("/projects/:id", (req: any, res) => {
    const p = projectPath(req.params.id);
    if (!fs.existsSync(p))
        return res.status(404).json({ error: "not found" });
    const data = JSON.parse(fs.readFileSync(p, "utf-8"));
    if (data.deviceId !== req.deviceId)
        return res.status(403).json({ error: "forbidden" });
    const updated = { ...data, ...req.body, id: data.id, deviceId: data.deviceId };
    fs.writeFileSync(p, JSON.stringify(updated, null, 2));
    res.json(updated);
});
router.delete("/projects/:id", (req: any, res) => {
    const p = projectPath(req.params.id);
    if (!fs.existsSync(p))
        return res.status(404).json({ error: "not found" });
    const data = JSON.parse(fs.readFileSync(p, "utf-8"));
    if (data.deviceId !== req.deviceId)
        return res.status(403).json({ error: "forbidden" });
    fs.unlinkSync(p);
    res.json({ ok: true });
});
export default router;

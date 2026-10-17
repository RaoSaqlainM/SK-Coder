import { Router, type IRouter } from "express";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
const router: IRouter = Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const WORKSPACE_DIR = join(__dirname, "../../../");
router.get("/download/source", async (req, res): Promise<void> => {
    res.setHeader("Content-Type", "application/gzip");
    res.setHeader("Content-Disposition", "attachment; filename=sk-coder-source.tar.gz");
    const excludes = [
        "--exclude=*/node_modules",
        "--exclude=*/.git",
        "--exclude=*/dist",
        "--exclude=*/.local",
        "--exclude=*/.cache",
        "--exclude=*/.vite",
        "--exclude=*.log",
        "--exclude=*/.tsbuildinfo",
    ];
    const targets = [
        "artifacts/sk-ide",
        "artifacts/api-server",
        "lib",
        "scripts",
        "package.json",
        "pnpm-workspace.yaml",
        "tsconfig.json",
        "tsconfig.base.json",
    ];
    const tar = spawn("tar", ["-czf", "-", ...excludes, ...targets], { cwd: WORKSPACE_DIR });
    tar.stdout.pipe(res);
    tar.stderr.on("data", (d) => {
        const msg = d.toString();
        if (!msg.includes("socket ignored") && !msg.includes("Removing leading")) {
            req.log?.warn({ msg }, "tar warning");
        }
    });
    tar.on("error", (err) => {
        if (!res.headersSent) {
            res.status(500).json({ error: err.message });
        }
    });
    tar.on("close", (code) => {
        if (code !== 0 && !res.writableEnded) {
            res.end();
        }
    });
});
export default router;

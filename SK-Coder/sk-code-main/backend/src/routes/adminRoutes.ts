import express from "express";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { authenticateAdmin, generateAdminToken } from "../middleware/adminAuth.js";
import { listWorkspaceRecords, markWorkspaceDeleted, getPoolUsage } from "../lib/workspaceRegistry.js";
import { sharedCapacitySummary } from "../lib/capacityLedger.js";
import { WORKSPACE_ROOT, TEMP_WORKSPACE_POOL_BYTES, PERSISTENT_WORKSPACE_POOL_BYTES } from "../lib/backendConfig.js";
import { listPlugins, createPlugin, updatePlugin, deletePlugin } from "../lib/pluginManager.js";

const router = express.Router();

router.post("/login", (req, res) => {
    const { username, password } = req.body;

    if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
        const token = generateAdminToken(username);
        return res.json({ token, username });
    }

    return res.status(401).json({ error: "Invalid credentials" });
});

router.use(authenticateAdmin);

router.get("/workspaces", async (req, res) => {
    try {
        const records = await listWorkspaceRecords();
        res.json(records.filter(r => r.state !== "deleted"));
    } catch (err) {
        console.error("Failed to list workspaces:", err);
        res.status(500).json({ error: "Failed to fetch workspaces" });
    }
});

router.delete("/workspace/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const workspacePath = join(WORKSPACE_ROOT, id);

        try {
            await rm(workspacePath, { recursive: true, force: true });
        } catch (err) {
            console.error("Failed to delete workspace directory:", err);
        }

        await markWorkspaceDeleted(id);
        res.json({ success: true, message: "Workspace deleted" });
    } catch (err) {
        console.error("Failed to delete workspace:", err);
        res.status(500).json({ error: "Failed to delete workspace" });
    }
});

router.get("/users", async (req, res) => {
    try {
        const workspaces = await listWorkspaceRecords();
        const userMap = new Map<string, { id: string; workspaces: number; totalBytes: number }>();

        workspaces.forEach(w => {
            if (w.state === "deleted") return;
            const userId = w.id.split("-")[0];
            const existing = userMap.get(userId) || { id: userId, workspaces: 0, totalBytes: 0 };
            existing.workspaces += 1;
            existing.totalBytes += w.quotaBytes;
            userMap.set(userId, existing);
        });

        res.json([...userMap.values()]);
    } catch (err) {
        console.error("Failed to list users:", err);
        res.status(500).json({ error: "Failed to fetch users" });
    }
});

router.delete("/user/:userId", async (req, res) => {
    try {
        const { userId } = req.params;
        const workspaces = await listWorkspaceRecords();
        const userWorkspaces = workspaces.filter(w => w.id.startsWith(userId) && w.state !== "deleted");

        for (const workspace of userWorkspaces) {
            const workspacePath = join(WORKSPACE_ROOT, workspace.id);
            try {
                await rm(workspacePath, { recursive: true, force: true });
            } catch (err) {
                console.error("Failed to delete workspace directory:", err);
            }
            await markWorkspaceDeleted(workspace.id);
        }

        res.json({
            success: true,
            message: "User data deleted",
            workspacesDeleted: userWorkspaces.length
        });
    } catch (err) {
        console.error("Failed to delete user:", err);
        res.status(500).json({ error: "Failed to delete user data" });
    }
});

router.get("/capacity", async (req, res) => {
    try {
        const workspaces = await listWorkspaceRecords();
        const summary = await sharedCapacitySummary();

        const tempPool = workspaces.filter(w => w.pool === "temporary" && w.state === "active");
        const persistentPool = workspaces.filter(w => w.pool === "persistent" && w.state === "active");

        res.json({
            tempPool: {
                used: tempPool.reduce((sum, w) => sum + w.quotaBytes, 0),
                total: TEMP_WORKSPACE_POOL_BYTES,
                workspaces: tempPool.length
            },
            persistentPool: {
                used: persistentPool.reduce((sum, w) => sum + w.quotaBytes, 0),
                total: PERSISTENT_WORKSPACE_POOL_BYTES,
                workspaces: persistentPool.length
            },
            queue: {
                length: 0
            },
            summary
        });
    } catch (err) {
        console.error("Failed to fetch capacity:", err);
        res.status(500).json({ error: "Failed to fetch capacity" });
    }
});

router.get("/logs", async (req, res) => {
    try {
        const logs = [
            { timestamp: new Date().toISOString(), level: "INFO", message: "Admin API started" },
            { timestamp: new Date().toISOString(), level: "INFO", message: "Plugin system initialized" }
        ];
        res.json(logs);
    } catch (err) {
        console.error("Failed to fetch logs:", err);
        res.status(500).json({ error: "Failed to fetch logs" });
    }
});

router.get("/plugins", async (req, res) => {
    try {
        const plugins = await listPlugins();
        res.json(plugins);
    } catch (err) {
        console.error("Failed to list plugins:", err);
        res.status(500).json({ error: "Failed to fetch plugins" });
    }
});

router.post("/plugins", async (req, res) => {
    try {
        const plugin = await createPlugin(req.body);
        res.json(plugin);
    } catch (err) {
        console.error("Failed to create plugin:", err);
        res.status(500).json({ error: "Failed to create plugin" });
    }
});

router.put("/plugins/:id", async (req, res) => {
    try {
        const plugin = await updatePlugin(req.params.id, req.body);
        if (!plugin) {
            return res.status(404).json({ error: "Plugin not found" });
        }
        res.json(plugin);
    } catch (err) {
        console.error("Failed to update plugin:", err);
        res.status(500).json({ error: "Failed to update plugin" });
    }
});

router.delete("/plugins/:id", async (req, res) => {
    try {
        const success = await deletePlugin(req.params.id);
        if (!success) {
            return res.status(404).json({ error: "Plugin not found" });
        }
        res.json({ success: true });
    } catch (err) {
        console.error("Failed to delete plugin:", err);
        res.status(500).json({ error: "Failed to delete plugin" });
    }
});

export default router;

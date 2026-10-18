import express from "express";
import { generatePluginInjection } from "../lib/pluginManager.js";

const router = express.Router();

router.get("/injection", async (req, res) => {
    try {
        const location = req.query.location as "header" | "footer" | "after_body_open";
        const path = req.query.path as string | undefined;

        if (!location || !["header", "footer", "after_body_open"].includes(location)) {
            return res.status(400).json({ error: "Invalid location" });
        }

        const injection = await generatePluginInjection(location, path);
        res.setHeader("Content-Type", "text/html");
        res.send(injection);
    } catch (err) {
        console.error("Failed to generate plugin injection:", err);
        res.status(500).json({ error: "Failed to generate injection" });
    }
});

export default router;

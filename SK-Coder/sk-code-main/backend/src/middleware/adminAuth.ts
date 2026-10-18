import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { ADMIN_USERNAME, JWT_SECRET } from "../lib/backendConfig.js";

if (!JWT_SECRET || JWT_SECRET.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters");
}

export function authenticateAdmin(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Missing or invalid authorization header" });
    }

    const token = authHeader.slice(7);

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as { username: string; role: string };

        if (decoded.role !== "admin" || decoded.username !== ADMIN_USERNAME) {
            return res.status(403).json({ error: "Not authorized" });
        }

        (req as any).admin = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: "Invalid or expired token" });
    }
}

export function generateAdminToken(username: string): string {
    return jwt.sign({ username, role: "admin" }, JWT_SECRET, { expiresIn: "24h" });
}

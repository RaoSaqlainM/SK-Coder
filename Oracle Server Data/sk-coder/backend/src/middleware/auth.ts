import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import type { JWTPayload } from "../types/auth.js";

const JWT_SECRET = process.env["JWT_SECRET"] || "";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  try {
    const token = req.cookies["auth_token"] || req.headers["authorization"]?.replace("Bearer ", "");

    if (!token) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const decoded = jwt.verify(token, JWT_SECRET || "fallback-secret-change-in-production") as JWTPayload;

    if (decoded.exp < Date.now()) {
      res.status(401).json({ error: "Token expired" });
      return;
    }

    (req as any).user = { username: decoded.username, role: decoded.role };
    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid token" });
  }
}

import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import type { LoginRequest, LoginResponse, AuthUser, JWTPayload } from "../types/auth.js";

const router = Router();

const ADMIN_USERNAME = process.env["ADMIN_USERNAME"] || "Admin-SK";
const ADMIN_PASSWORD = process.env["ADMIN_PASSWORD"] || "";
const JWT_SECRET = process.env["JWT_SECRET"] || "";
const JWT_EXPIRY_REMEMBER = Number(process.env["JWT_EXPIRY_REMEMBER"] || 604800000);
const JWT_EXPIRY_NORMAL = Number(process.env["JWT_EXPIRY_NORMAL"] || 86400000);

if (!JWT_SECRET) {
  console.warn("WARNING: JWT_SECRET not set. Authentication will not work properly.");
}

let passwordHash: string | null = null;

async function getPasswordHash(): Promise<string> {
  if (passwordHash) return passwordHash;
  if (!ADMIN_PASSWORD) {
    throw new Error("ADMIN_PASSWORD not configured in environment");
  }
  passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  return passwordHash;
}

function createToken(user: AuthUser, rememberMe: boolean): string {
  const expiryMs = rememberMe ? JWT_EXPIRY_REMEMBER : JWT_EXPIRY_NORMAL;
  const payload: JWTPayload = {
    username: user.username,
    role: user.role,
    iat: Date.now(),
    exp: Date.now() + expiryMs,
  };
  return jwt.sign(payload, JWT_SECRET || "fallback-secret-change-in-production");
}

router.post("/login", async (req: Request, res: Response) => {
  try {
    const { username, password, rememberMe = true }: LoginRequest = req.body;
    
    if (!username || !password) {
      res.status(400).json({ success: false, error: "Username and password required" } as LoginResponse);
      return;
    }

    if (!ADMIN_PASSWORD) {
      res.status(500).json({ success: false, error: "Server misconfigured: ADMIN_PASSWORD not set" } as LoginResponse);
      return;
    }

    if (username !== ADMIN_USERNAME) {
      res.status(401).json({ success: false, error: "Invalid credentials" } as LoginResponse);
      return;
    }

    const hashedPassword = await getPasswordHash();
    const isValid = await bcrypt.compare(password, hashedPassword);

    if (!isValid) {
      res.status(401).json({ success: false, error: "Invalid credentials" } as LoginResponse);
      return;
    }

    const user: AuthUser = { username, role: "admin" };
    const token = createToken(user, rememberMe);

    res.cookie("auth_token", token, {
      httpOnly: true,
      secure: process.env["NODE_ENV"] === "production",
      sameSite: "strict",
      maxAge: rememberMe ? JWT_EXPIRY_REMEMBER : JWT_EXPIRY_NORMAL,
    });

    res.json({ success: true, user } as LoginResponse);
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ success: false, error: "Internal server error" } as LoginResponse);
  }
});

router.get("/me", (req: Request, res: Response) => {
  try {
    const token = req.cookies["auth_token"] || req.headers["authorization"]?.replace("Bearer ", "");

    if (!token) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const decoded = jwt.verify(token, JWT_SECRET || "fallback-secret-change-in-production") as JWTPayload;

    if (decoded.exp < Date.now()) {
      res.status(401).json({ error: "Token expired" });
      return;
    }

    res.json({ username: decoded.username, role: decoded.role });
  } catch (error) {
    res.status(401).json({ error: "Invalid token" });
  }
});

router.post("/logout", (_req: Request, res: Response) => {
  res.clearCookie("auth_token", {
    httpOnly: true,
    secure: process.env["NODE_ENV"] === "production",
    sameSite: "strict",
  });
  res.json({ success: true });
});

export default router;

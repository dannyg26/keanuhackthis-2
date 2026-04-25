import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { db } from "./db.ts";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-please-change-me";
const TOKEN_TTL = "7d";

export interface JwtPayload { sub: string; email: string; }
export interface UserRow {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  created_at: string;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function signToken(user: { id: string; email: string }): string {
  return jwt.sign({ sub: user.id, email: user.email } satisfies JwtPayload, JWT_SECRET, {
    expiresIn: TOKEN_TTL,
  });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

export interface AuthedRequest extends Request {
  user?: { id: string; email: string; name: string };
}

const findUserById = db.prepare<[string], UserRow>("SELECT * FROM users WHERE id = ?");

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing bearer token" });
  }
  try {
    const payload = verifyToken(header.slice("Bearer ".length));
    const user = findUserById.get(payload.sub);
    if (!user) return res.status(401).json({ error: "User no longer exists" });
    req.user = { id: user.id, email: user.email, name: user.name };
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function publicUser(u: UserRow) {
  return { id: u.id, email: u.email, name: u.name, createdAt: u.created_at };
}

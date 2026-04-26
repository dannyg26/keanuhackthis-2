import { Router } from "express";
import { z } from "zod";
import { db, uid } from "../db.ts";
import {
  hashPassword, verifyPassword, signToken, requireAuth, publicUser,
  type AuthedRequest, type UserRow,
} from "../auth.ts";

const router = Router();

const SignupBody = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(8, "Password must be at least 8 characters."),
  name: z.string().min(1).max(80),
});

const LoginBody = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1),
});

const findByEmail = db.prepare<[string], UserRow>("SELECT * FROM users WHERE email = ?");
const insertUser = db.prepare(
  "INSERT INTO users (id, email, name, password_hash) VALUES (?, ?, ?, ?)",
);

router.post("/signup", async (req, res) => {
  const parsed = SignupBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const { email, password, name } = parsed.data;

  if (findByEmail.get(email)) return res.status(409).json({ error: "Email already registered" });

  const id = uid("user");
  const hash = await hashPassword(password);
  insertUser.run(id, email, name, hash);
  const user = findByEmail.get(email)!;
  const token = signToken(user);
  res.status(201).json({ token, user: publicUser(user) });
});

router.post("/login", async (req, res) => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const { email, password } = parsed.data;

  const user = findByEmail.get(email);
  if (!user) return res.status(401).json({ error: "Invalid email or password" });

  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: "Invalid email or password" });

  const token = signToken(user);
  res.json({ token, user: publicUser(user) });
});

router.get("/me", requireAuth, (req: AuthedRequest, res) => {
  res.json({ user: req.user });
});

export default router;

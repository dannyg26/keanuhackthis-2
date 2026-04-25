import { Router } from "express";
import { z } from "zod";
import { db, uid } from "../db.ts";
import { requireAuth, type AuthedRequest } from "../auth.ts";
import { companionReply } from "../lib/claude.ts";

const router = Router();
router.use(requireAuth);

const ChatBody = z.object({
  message: z.string().min(1).max(1000),
  context: z.object({
    riskScore: z.number().nullable().optional(),
    riskLevel: z.string().nullable().optional(),
    adherencePct: z.number().nullable().optional(),
    streakDays: z.number().nullable().optional(),
    medications: z.array(z.string()).optional(),
  }).optional(),
});

interface MsgRow {
  id: string; user_id: string; role: "user" | "assistant"; content: string; created_at: string;
}

const insertStmt = db.prepare(
  "INSERT INTO companion_messages (id, user_id, role, content) VALUES (?, ?, ?, ?)",
);
const historyStmt = db.prepare<[string, number], MsgRow>(
  "SELECT * FROM companion_messages WHERE user_id = ? ORDER BY created_at ASC LIMIT ?",
);

router.post("/chat", async (req: AuthedRequest, res) => {
  const parsed = ChatBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });

  const { message, context = {} } = parsed.data;

  // Save user turn
  insertStmt.run(uid("msg"), req.user!.id, "user", message);

  // Build history (last 24)
  const rows = historyStmt.all(req.user!.id, 24);
  const history = rows.map(r => ({ role: r.role, content: r.content }));

  const { reply, provider } = await companionReply(history, context);

  insertStmt.run(uid("msg"), req.user!.id, "assistant", reply);
  res.json({ reply, provider });
});

router.get("/history", (req: AuthedRequest, res) => {
  const rows = historyStmt.all(req.user!.id, 50);
  res.json({
    messages: rows.map(r => ({
      id: r.id, role: r.role, content: r.content, createdAt: r.created_at,
    })),
  });
});

router.delete("/history", (req: AuthedRequest, res) => {
  db.prepare("DELETE FROM companion_messages WHERE user_id = ?").run(req.user!.id);
  res.status(204).end();
});

export default router;

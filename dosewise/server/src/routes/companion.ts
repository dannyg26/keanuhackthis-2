import { Router } from "express";
import { z } from "zod";
import { db, uid } from "../db.ts";
import { requireAuth, type AuthedRequest } from "../auth.ts";
import { companionReply } from "../lib/claude.ts";

const router = Router();
router.use(requireAuth);

const ChatBody = z.object({
  message: z.string().min(1).max(5000),
  context: z
    .object({
      riskScore: z.number().nullable().optional(),
      riskLevel: z.string().nullable().optional(),
      adherencePct: z.number().nullable().optional(),
      streakDays: z.number().nullable().optional(),
      medications: z.array(z.string()).optional(),
    })
    .optional(),
});

interface MedRow {
  name: string;
  dosage: string | null;
  frequency: string | null;
  purpose: string | null;
  side_effects: string | null;
}
const medListStmt = db.prepare<[string], MedRow>(
  "SELECT name, dosage, frequency, purpose, side_effects FROM medications WHERE user_id = ? ORDER BY created_at DESC",
);

interface MsgRow {
  id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

const insertStmt = db.prepare(
  "INSERT INTO companion_messages (id, user_id, role, content) VALUES (?, ?, ?, ?)",
);
const historyStmt = db.prepare<[string, number], MsgRow>(
  "SELECT * FROM companion_messages WHERE user_id = ? ORDER BY created_at ASC LIMIT ?",
);

router.post("/chat", async (req: AuthedRequest, res) => {
  const parsed = ChatBody.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0]?.message });

  const { message, context = {} } = parsed.data;

  // Save user turn
  insertStmt.run(uid("msg"), req.user!.id, "user", message);

  // Build history — fetch more rows but strip old fallback messages before sending to AI
  const rows = historyStmt.all(req.user!.id, 40);
  const FALLBACK_PREFIXES = [
    "I'm not sure I caught that",
    "Your risk score is",
    "You're at ",
    "Drop a bill on",
    "You have active coupons",
    "Your current meds:",
    "Hey there. I'm Dose",
    "You got it.",
    "I couldn't reach the server",
  ];
  const history = rows
    .filter(
      (r) =>
        !(
          r.role === "assistant" &&
          FALLBACK_PREFIXES.some((p) => r.content.startsWith(p))
        ),
    )
    .slice(-12)
    .map((r) => ({ role: r.role, content: r.content }));

  // Fetch user's medication details for AI context
  const medRows = medListStmt.all(req.user!.id);
  const medicationDetails = medRows.map((r) => ({
    name: r.name,
    dosage: r.dosage ?? "",
    frequency: r.frequency ?? "",
    purpose: r.purpose ?? "",
    sideEffects: r.side_effects ? (JSON.parse(r.side_effects) as string[]) : [],
  }));

  const { reply, provider } = await companionReply(message, history, {
    ...context,
    medicationDetails,
  });

  insertStmt.run(uid("msg"), req.user!.id, "assistant", reply);
  res.json({ reply, provider });
});

router.get("/history", (req: AuthedRequest, res) => {
  const rows = historyStmt.all(req.user!.id, 50);
  res.json({
    messages: rows.map((r) => ({
      id: r.id,
      role: r.role,
      content: r.content,
      createdAt: r.created_at,
    })),
  });
});

router.delete("/history", (req: AuthedRequest, res) => {
  db.prepare("DELETE FROM companion_messages WHERE user_id = ?").run(
    req.user!.id,
  );
  res.status(204).end();
});

export default router;

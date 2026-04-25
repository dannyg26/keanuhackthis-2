import { Router } from "express";
import { z } from "zod";
import { db, uid } from "../db.ts";
import { requireAuth, type AuthedRequest } from "../auth.ts";

const router = Router();
router.use(requireAuth);

const Body = z.object({
  medicationId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  taken: z.boolean(),
});

const Query = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

interface Row {
  id: string; user_id: string; medication_id: string; date: string;
  taken: number; created_at: string;
}

function shape(r: Row) {
  return { id: r.id, medicationId: r.medication_id, date: r.date, taken: !!r.taken, createdAt: r.created_at };
}

const listAll = db.prepare<[string], Row>("SELECT * FROM adherence_logs WHERE user_id = ? ORDER BY date DESC");
const listRange = db.prepare<[string, string, string], Row>(
  "SELECT * FROM adherence_logs WHERE user_id = ? AND date BETWEEN ? AND ? ORDER BY date DESC",
);
const upsert = db.prepare(`
  INSERT INTO adherence_logs (id, user_id, medication_id, date, taken)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(user_id, medication_id, date) DO UPDATE SET taken = excluded.taken
`);
const findExact = db.prepare<[string, string, string], Row>(
  "SELECT * FROM adherence_logs WHERE user_id = ? AND medication_id = ? AND date = ?",
);
const deleteStmt = db.prepare<[string, string]>("DELETE FROM adherence_logs WHERE id = ? AND user_id = ?");

router.get("/", (req: AuthedRequest, res) => {
  const q = Query.safeParse(req.query);
  if (!q.success) return res.status(400).json({ error: "Invalid date range" });
  const { from, to } = q.data;
  const rows = from && to
    ? listRange.all(req.user!.id, from, to)
    : listAll.all(req.user!.id);
  res.json({ logs: rows.map(shape) });
});

router.post("/", (req: AuthedRequest, res) => {
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const { medicationId, date, taken } = parsed.data;
  upsert.run(uid("log"), req.user!.id, medicationId, date, taken ? 1 : 0);
  const row = findExact.get(req.user!.id, medicationId, date)!;
  res.status(201).json({ log: shape(row) });
});

router.delete("/:id", (req: AuthedRequest, res) => {
  const result = deleteStmt.run(req.params.id, req.user!.id);
  if (result.changes === 0) return res.status(404).json({ error: "Log not found" });
  res.status(204).end();
});

router.get("/stats", (req: AuthedRequest, res) => {
  const rows = listAll.all(req.user!.id);
  const total = rows.length;
  const taken = rows.filter(r => r.taken === 1).length;
  res.json({
    total,
    taken,
    missed: total - taken,
    adherencePct: total ? Math.round((taken / total) * 100) : 0,
  });
});

export default router;

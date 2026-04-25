import { Router } from "express";
import { z } from "zod";
import { db, uid } from "../db.ts";
import { requireAuth, type AuthedRequest } from "../auth.ts";
import { billTotal, parseBillText } from "../lib/bill.ts";

const router = Router();
router.use(requireAuth);

const Body = z.object({ rawText: z.string().min(1).max(20000) });

interface Row {
  id: string; user_id: string; raw_text: string; items_json: string;
  total: number; created_at: string;
}

function shape(r: Row) {
  return {
    id: r.id,
    rawText: r.raw_text,
    items: JSON.parse(r.items_json),
    total: r.total,
    createdAt: r.created_at,
  };
}

const insertStmt = db.prepare(`
  INSERT INTO bills (id, user_id, raw_text, items_json, total) VALUES (?, ?, ?, ?, ?)
`);
const findStmt = db.prepare<[string, string], Row>("SELECT * FROM bills WHERE id = ? AND user_id = ?");
const listStmt = db.prepare<[string], Row>(
  "SELECT * FROM bills WHERE user_id = ? ORDER BY created_at DESC LIMIT 50",
);
const deleteStmt = db.prepare<[string, string]>("DELETE FROM bills WHERE id = ? AND user_id = ?");

router.post("/parse", (req: AuthedRequest, res) => {
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const items = parseBillText(parsed.data.rawText);
  const total = billTotal(items);
  const id = uid("bill");
  insertStmt.run(id, req.user!.id, parsed.data.rawText, JSON.stringify(items), total);
  res.status(201).json({ bill: shape(findStmt.get(id, req.user!.id)!) });
});

router.get("/", (req: AuthedRequest, res) => {
  res.json({ bills: listStmt.all(req.user!.id).map(shape) });
});

router.get("/:id", (req: AuthedRequest, res) => {
  const row = findStmt.get(req.params.id, req.user!.id);
  if (!row) return res.status(404).json({ error: "Bill not found" });
  res.json({ bill: shape(row) });
});

router.delete("/:id", (req: AuthedRequest, res) => {
  const r = deleteStmt.run(req.params.id, req.user!.id);
  if (r.changes === 0) return res.status(404).json({ error: "Bill not found" });
  res.status(204).end();
});

export default router;

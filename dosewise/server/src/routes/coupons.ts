import { Router } from "express";
import { z } from "zod";
import { db, uid } from "../db.ts";
import { requireAuth, type AuthedRequest } from "../auth.ts";

const router = Router();
router.use(requireAuth);

const Body = z.object({
  medication: z.string().min(1).max(120),
  pharmacy: z.string().min(1).max(120),
  originalPrice: z.number().nonnegative(),
  couponPrice: z.number().nonnegative(),
  expiresOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  code: z.string().min(1).max(80),
  source: z.enum(["GoodRx", "Manufacturer", "Insurance", "Local", "Custom"]),
  note: z.string().max(400).optional(),
  saved: z.boolean().optional().default(false),
});

const ToggleBody = z.object({ saved: z.boolean() });

interface Row {
  id: string; user_id: string;
  medication: string; pharmacy: string;
  original_price: number; coupon_price: number;
  expires_on: string; code: string; source: string;
  note: string | null; saved: number; created_at: string;
}

function shape(r: Row) {
  return {
    id: r.id,
    medication: r.medication,
    pharmacy: r.pharmacy,
    originalPrice: r.original_price,
    couponPrice: r.coupon_price,
    expiresOn: r.expires_on,
    code: r.code,
    source: r.source,
    note: r.note ?? undefined,
    saved: !!r.saved,
    createdAt: r.created_at,
  };
}

const insertStmt = db.prepare(`
  INSERT INTO coupons (id, user_id, medication, pharmacy, original_price, coupon_price, expires_on, code, source, note, saved)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const findStmt = db.prepare<[string, string], Row>("SELECT * FROM coupons WHERE id = ? AND user_id = ?");
const listStmt = db.prepare<[string], Row>(
  "SELECT * FROM coupons WHERE user_id = ? ORDER BY created_at DESC",
);
const toggleStmt = db.prepare<[number, string, string]>(
  "UPDATE coupons SET saved = ? WHERE id = ? AND user_id = ?",
);
const deleteStmt = db.prepare<[string, string]>("DELETE FROM coupons WHERE id = ? AND user_id = ?");

router.get("/", (req: AuthedRequest, res) => {
  res.json({ coupons: listStmt.all(req.user!.id).map(shape) });
});

router.post("/", (req: AuthedRequest, res) => {
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const c = parsed.data;
  const id = uid("cpn");
  insertStmt.run(
    id, req.user!.id, c.medication, c.pharmacy, c.originalPrice, c.couponPrice,
    c.expiresOn, c.code, c.source, c.note ?? null, c.saved ? 1 : 0,
  );
  res.status(201).json({ coupon: shape(findStmt.get(id, req.user!.id)!) });
});

router.patch("/:id/save", (req: AuthedRequest, res) => {
  const parsed = ToggleBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Body must be { saved: boolean }" });
  const result = toggleStmt.run(parsed.data.saved ? 1 : 0, req.params.id, req.user!.id);
  if (result.changes === 0) return res.status(404).json({ error: "Coupon not found" });
  res.json({ coupon: shape(findStmt.get(req.params.id, req.user!.id)!) });
});

router.delete("/:id", (req: AuthedRequest, res) => {
  const r = deleteStmt.run(req.params.id, req.user!.id);
  if (r.changes === 0) return res.status(404).json({ error: "Coupon not found" });
  res.status(204).end();
});

export default router;

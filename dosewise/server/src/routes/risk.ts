import { Router } from "express";
import { z } from "zod";
import { db, uid } from "../db.ts";
import { requireAuth, type AuthedRequest } from "../auth.ts";
import { computeRisk } from "../lib/risk.ts";

const router = Router();
router.use(requireAuth);

const Body = z.object({
  medications: z.array(z.string()).default([]),
  sleepHours: z.number().min(0).max(24),
  alcoholUse: z.enum(["none", "occasional", "regular"]),
  missedDosesPerWeek: z.number().int().min(0).max(50),
  inconsistentTiming: z.boolean(),
  ageRange: z.enum(["under-18", "18-39", "40-64", "65+"]),
  numberOfMedications: z.number().int().min(0).max(50),
});

interface Row {
  id: string; user_id: string;
  input_json: string; result_json: string;
  score: number; level: string; created_at: string;
}

function shape(r: Row) {
  return {
    id: r.id,
    input: JSON.parse(r.input_json),
    result: JSON.parse(r.result_json),
    score: r.score,
    level: r.level,
    createdAt: r.created_at,
  };
}

const insertStmt = db.prepare(`
  INSERT INTO risk_assessments (id, user_id, input_json, result_json, score, level)
  VALUES (?, ?, ?, ?, ?, ?)
`);
const findStmt = db.prepare<[string, string], Row>(
  "SELECT * FROM risk_assessments WHERE id = ? AND user_id = ?",
);
const listStmt = db.prepare<[string], Row>(
  "SELECT * FROM risk_assessments WHERE user_id = ? ORDER BY created_at DESC LIMIT 30",
);
const latestStmt = db.prepare<[string], Row>(
  "SELECT * FROM risk_assessments WHERE user_id = ? ORDER BY created_at DESC LIMIT 1",
);

router.post("/calculate", (req: AuthedRequest, res) => {
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const result = computeRisk(parsed.data);
  const id = uid("risk");
  insertStmt.run(
    id, req.user!.id, JSON.stringify(parsed.data), JSON.stringify(result), result.score, result.level,
  );
  res.status(201).json({ assessment: shape(findStmt.get(id, req.user!.id)!) });
});

router.get("/history", (req: AuthedRequest, res) => {
  res.json({ assessments: listStmt.all(req.user!.id).map(shape) });
});

router.get("/latest", (req: AuthedRequest, res) => {
  const row = latestStmt.get(req.user!.id);
  res.json({ assessment: row ? shape(row) : null });
});

export default router;

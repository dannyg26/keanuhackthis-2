import { Router } from "express";
import { z } from "zod";
import { db, uid } from "../db.ts";
import { requireAuth, type AuthedRequest } from "../auth.ts";
import { enrichMedication } from "../lib/claude.ts";

const router = Router();
router.use(requireAuth);

const ScheduleSlot = z.object({
  time: z.string(),
  label: z.string(),
  withFood: z.boolean(),
});

const Body = z.object({
  name: z.string().min(1).max(120),
  dosage: z.string().max(120).optional().default(""),
  frequency: z.string().max(120).optional().default(""),
  purpose: z.string().max(400).optional().default(""),
  category: z.string().max(120).optional().default(""),
  sideEffects: z.array(z.string()).default([]),
  callDoctor: z.array(z.string()).default([]),
  schedule: z.array(ScheduleSlot).default([]),
  refillsLeft: z.number().int().min(0).max(99).nullable().optional(),
});

interface Row {
  id: string;
  user_id: string;
  name: string;
  dosage: string | null;
  frequency: string | null;
  purpose: string | null;
  category: string | null;
  side_effects: string | null;
  call_doctor: string | null;
  schedule: string | null;
  refills_left: number | null;
  created_at: string;
}

function parseRow(r: Row) {
  return {
    id: r.id,
    name: r.name,
    dosage: r.dosage ?? "",
    frequency: r.frequency ?? "",
    purpose: r.purpose ?? "",
    category: r.category ?? "",
    sideEffects: r.side_effects ? JSON.parse(r.side_effects) : [],
    callDoctor: r.call_doctor ? JSON.parse(r.call_doctor) : [],
    schedule: r.schedule ? JSON.parse(r.schedule) : [],
    refillsLeft: r.refills_left ?? null,
    createdAt: r.created_at,
  };
}

const listStmt = db.prepare<[string], Row>("SELECT * FROM medications WHERE user_id = ? ORDER BY created_at DESC");
const getStmt = db.prepare<[string, string], Row>("SELECT * FROM medications WHERE id = ? AND user_id = ?");
const insertStmt = db.prepare(`
  INSERT INTO medications (id, user_id, name, dosage, frequency, purpose, category, side_effects, call_doctor, schedule, refills_left)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const updateStmt = db.prepare(`
  UPDATE medications SET name = ?, dosage = ?, frequency = ?, purpose = ?, category = ?,
    side_effects = ?, call_doctor = ?, schedule = ?, refills_left = ?
  WHERE id = ? AND user_id = ?
`);
const deleteStmt = db.prepare("DELETE FROM medications WHERE id = ? AND user_id = ?");

router.get("/", (req: AuthedRequest, res) => {
  const rows = listStmt.all(req.user!.id);
  res.json({ medications: rows.map(parseRow) });
});

router.post("/", (req: AuthedRequest, res) => {
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const m = parsed.data;
  const id = uid("med");
  insertStmt.run(
    id, req.user!.id, m.name, m.dosage, m.frequency, m.purpose, m.category,
    JSON.stringify(m.sideEffects), JSON.stringify(m.callDoctor), JSON.stringify(m.schedule),
    m.refillsLeft ?? null,
  );
  res.status(201).json({ medication: parseRow(getStmt.get(id, req.user!.id)!) });
});

router.put("/:id", (req: AuthedRequest, res) => {
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const m = parsed.data;
  const result = updateStmt.run(
    m.name, m.dosage, m.frequency, m.purpose, m.category,
    JSON.stringify(m.sideEffects), JSON.stringify(m.callDoctor), JSON.stringify(m.schedule),
    m.refillsLeft ?? null,
    req.params.id, req.user!.id,
  );
  if (result.changes === 0) return res.status(404).json({ error: "Medication not found" });
  res.json({ medication: parseRow(getStmt.get(req.params.id, req.user!.id)!) });
});

router.delete("/:id", (req: AuthedRequest, res) => {
  const result = deleteStmt.run(req.params.id, req.user!.id);
  if (result.changes === 0) return res.status(404).json({ error: "Medication not found" });
  res.status(204).end();
});

const EnrichBody = z.object({
  name: z.string().min(1).max(120),
  genericName: z.string().max(200).optional(),
  dosageForm: z.string().max(80).optional(),
  route: z.string().max(80).optional(),
  activeIngredients: z.array(z.object({
    name: z.string(),
    strength: z.string().optional(),
  })).optional(),
});

router.post("/enrich", async (req: AuthedRequest, res) => {
  const parsed = EnrichBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const result = await enrichMedication(parsed.data);
  res.json({ enrichment: result });
});

export default router;

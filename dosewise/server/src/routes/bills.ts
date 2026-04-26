import { Router } from "express";
import { z } from "zod";
import { db, uid } from "../db.ts";
import { requireAuth, type AuthedRequest } from "../auth.ts";
import { billTotal, parseBillText } from "../lib/bill.ts";
import { groqChat } from "../lib/groqHelper.ts";

const router = Router();
router.use(requireAuth);

const Body = z.object({ rawText: z.string().min(1).max(20000) });

const AiAnalyzeBody = z.object({
  rawText: z.string().max(20000).optional(),
  imageBase64: z.string().max(6_000_000).optional(),
  imageMediaType: z.string().max(50).optional(),
});

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

/* ── Types ────────────────────────────────────────────────────────────────── */

type Issue = {
  type: string;
  description: string;
  severity: "warning" | "info";
  relatedCharges?: string[];
};

type Charge = {
  name: string;
  amount: number;
  category: string;
  explanation: string;
};

type BenchmarkHit = {
  chargeName: string;
  category: string;
  amount: number;
  benchmarkName: string;
  low: number;
  high: number;
  multiple: number;
  potentialSavings: number;
  severity: "ok" | "watch" | "high";
  confidence: number;
};

type BillAudit = {
  score: number;
  potentialSavings: number;
  benchmarkedCharges: BenchmarkHit[];
  duplicateGroups: Array<{ names: string[]; amount: number; potentialSavings: number }>;
  vagueCharges: string[];
  summary: string;
};

type Analysis = {
  summary: string;
  charges: Charge[];
  total: number;
  issues: Issue[];
  questions: string[];
  score: number;
  audit: BillAudit;
};

const ALLOWED_ISSUE_TYPES = new Set(["duplicate", "high_cost", "vague", "unclear", "repeated_fee"]);

/* ── Benchmarks ───────────────────────────────────────────────────────────── */

const BENCHMARKS: Array<{ name: string; aliases: string[]; category: string; low: number; high: number }> = [
  { name: "Comprehensive blood panel", aliases: ["blood panel", "comprehensive metabolic", "metabolic panel", "cbc", "blood test", "lab panel"], category: "Laboratory", low: 45, high: 140 },
  { name: "Basic lab processing", aliases: ["lab processing", "lab fee", "specimen handling", "venipuncture", "blood draw"], category: "Laboratory", low: 15, high: 75 },
  { name: "Urinalysis", aliases: ["urinalysis", "urine test", "ua test"], category: "Laboratory", low: 20, high: 80 },
  { name: "X-ray", aliases: ["x-ray", "xray", "radiograph"], category: "Imaging", low: 80, high: 300 },
  { name: "CT scan", aliases: ["ct scan", "computed tomography", "cat scan"], category: "Imaging", low: 350, high: 1500 },
  { name: "MRI", aliases: ["mri", "magnetic resonance"], category: "Imaging", low: 500, high: 2200 },
  { name: "Ultrasound", aliases: ["ultrasound", "sonogram"], category: "Imaging", low: 120, high: 600 },
  { name: "ER facility fee", aliases: ["er facility", "emergency room facility", "emergency department facility", "facility fee"], category: "Facility Fee", low: 300, high: 1200 },
  { name: "Physician evaluation", aliases: ["physician evaluation", "doctor evaluation", "provider evaluation", "professional fee", "office visit"], category: "Professional Fee", low: 100, high: 350 },
  { name: "Urgent care visit", aliases: ["urgent care", "walk-in visit", "walk in visit"], category: "Professional Fee", low: 100, high: 250 },
  { name: "Medication administration", aliases: ["medication", "injection", "iv medication", "drug administration"], category: "Medication", low: 15, high: 150 },
  { name: "Administrative fee", aliases: ["administrative", "records fee", "supply fee", "miscellaneous", "misc fee"], category: "Administrative", low: 0, high: 50 },
];

function normalizeChargeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(fee|charge|service|services|medical|hospital)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function benchmarkCharge(charge: Charge): BenchmarkHit | null {
  const normalized = normalizeChargeName(charge.name);
  const category = charge.category.toLowerCase();
  let best: { name: string; category: string; low: number; high: number; confidence: number } | null = null;

  for (const benchmark of BENCHMARKS) {
    const categoryBoost = benchmark.category.toLowerCase() === category ? 15 : 0;
    for (const alias of benchmark.aliases) {
      const normalizedAlias = normalizeChargeName(alias);
      const direct = normalized.includes(normalizedAlias) || normalizedAlias.includes(normalized);
      const tokenHits = normalizedAlias.split(" ").filter((token) => token.length > 2 && normalized.includes(token)).length;
      const confidence = direct ? 90 + categoryBoost : Math.min(70, tokenHits * 22 + categoryBoost);
      if (confidence >= 44 && (!best || confidence > best.confidence)) {
        best = { name: benchmark.name, category: benchmark.category, low: benchmark.low, high: benchmark.high, confidence: Math.min(98, confidence) };
      }
    }
  }

  if (!best) return null;
  const multiple = best.high > 0 ? charge.amount / best.high : 1;
  const potentialSavings = Math.max(0, Math.round(charge.amount - best.high));
  const severity: BenchmarkHit["severity"] = multiple >= 1.75 ? "high" : multiple >= 1.15 ? "watch" : "ok";

  return {
    chargeName: charge.name,
    category: charge.category,
    amount: charge.amount,
    benchmarkName: best.name,
    low: best.low,
    high: best.high,
    multiple: Math.round(multiple * 10) / 10,
    potentialSavings,
    severity,
    confidence: best.confidence,
  };
}

function auditBill(charges: Charge[], issues: Issue[]): BillAudit {
  const benchmarkedCharges = charges
    .map(benchmarkCharge)
    .filter((hit): hit is BenchmarkHit => hit !== null);

  const duplicateMap = new Map<string, Charge[]>();
  for (const charge of charges) {
    const key = `${normalizeChargeName(charge.name)}|${Math.round(charge.amount)}`;
    const list = duplicateMap.get(key) ?? [];
    list.push(charge);
    duplicateMap.set(key, list);
  }
  const duplicateGroups = Array.from(duplicateMap.values())
    .filter((group) => group.length > 1)
    .map((group) => ({
      names: group.map((charge) => charge.name),
      amount: group[0].amount,
      potentialSavings: Math.round(group.slice(1).reduce((sum, charge) => sum + charge.amount, 0)),
    }));

  const vaguePattern = /\b(misc|miscellaneous|other|supply|supplies|admin|administrative|service fee|processing fee|facility fee)\b/i;
  const vagueCharges = charges
    .filter((charge) => vaguePattern.test(charge.name) || charge.category === "Other" || charge.category === "Administrative")
    .map((charge) => charge.name);

  const benchmarkSavings = benchmarkedCharges.reduce((sum, hit) => sum + hit.potentialSavings, 0);
  const duplicateSavings = duplicateGroups.reduce((sum, group) => sum + group.potentialSavings, 0);
  const potentialSavings = Math.round(benchmarkSavings + duplicateSavings);
  const highCount = benchmarkedCharges.filter((hit) => hit.severity === "high").length;
  const watchCount = benchmarkedCharges.filter((hit) => hit.severity === "watch").length;
  const warningIssues = issues.filter((issue) => issue.severity === "warning").length;
  const penalty = highCount * 16 + watchCount * 8 + duplicateGroups.length * 14 + Math.min(18, vagueCharges.length * 5) + Math.min(16, warningIssues * 4);
  const score = Math.max(0, Math.min(100, 100 - penalty));
  const summary = potentialSavings > 0
    ? `Pricing engine found about $${potentialSavings.toLocaleString("en-US")} in possible savings to question.`
    : benchmarkedCharges.length > 0
      ? "Pricing engine did not find a clear benchmark overage, but some items may still be worth clarifying."
      : "Pricing engine had limited benchmark matches for this bill, so the explanation and itemized questions matter more.";

  return { score, potentialSavings, benchmarkedCharges, duplicateGroups, vagueCharges, summary };
}

function robustParse(raw: string): unknown {
  let s = raw.replace(/^```(?:json|JSON)?\s*/m, "").replace(/\s*```\s*$/m, "").trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start >= 0 && end > start) s = s.slice(start, end + 1);
  try { return JSON.parse(s); } catch { /* continue */ }
  const p2 = s.replace(/([{,]\s*)'([^']*?)'\s*:/g, '$1"$2":');
  try { return JSON.parse(p2); } catch { /* continue */ }
  const p3 = p2.replace(/,(\s*[}\]])/g, "$1");
  try { return JSON.parse(p3); } catch { /* continue */ }
  const p4 = p3.replace(/['']/g, "'").replace(/[""]/g, '"');
  try { return JSON.parse(p4); } catch { /* continue */ }
  throw new Error("Could not parse response as JSON. Please try again.");
}

async function repairJsonResponse(raw: string): Promise<unknown> {
  const completion = await groqChat({
    messages: [
      {
        role: "system",
        content: [
          "Convert the user content into exactly one valid JSON object.",
          "Return only JSON. No markdown, no explanation, no code fences.",
          'Use this shape: {"summary":"string","charges":[{"name":"string","amount":0,"category":"string","explanation":"string"}],"total":0,"issues":[{"type":"unclear","description":"string","severity":"info","relatedCharges":["string"]}],"questions":["string"]}',
        ].join(" "),
      },
      { role: "user", content: raw.slice(0, 12000) },
    ],
    temperature: 0,
    max_tokens: 2048,
    response_format: { type: "json_object" },
  });
  return robustParse(completion.choices[0]?.message?.content ?? "");
}

function parseTextCharges(billText: string): Array<{ name: string; amount: number }> {
  return billText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(.*?)(?:\s*[-:]\s*|\s+)\$?\s*([0-9][0-9,]*(?:\.[0-9]{2})?)$/);
      if (!match) return null;
      return { name: match[1].trim(), amount: Number(match[2].replace(/,/g, "")) };
    })
    .filter((charge): charge is { name: string; amount: number } => charge !== null);
}

function fallbackExplanation(name: string, category: string): string {
  const lowerName = name.toLowerCase();
  if (lowerName.includes("facility")) {
    return "This is commonly a hospital or clinic facility charge for using the location, equipment, staff, and overhead tied to the visit.";
  }
  if (lowerName.includes("lab") || lowerName.includes("blood") || category === "Laboratory") {
    return "This is related to lab testing or processing. It can cover collecting the sample, running the test, and reporting the results.";
  }
  if (lowerName.includes("physician") || lowerName.includes("doctor") || category === "Professional Fee") {
    return "This is usually the provider charge for the clinician evaluating you, documenting the visit, and making care decisions.";
  }
  if (category === "Imaging") {
    return "This is related to medical imaging, such as an X-ray, CT, MRI, ultrasound, or the professional review of those images.";
  }
  if (category === "Medication") {
    return "This is related to medication given, supplied, or billed during the visit.";
  }
  if (category === "Procedure") {
    return "This is related to a medical procedure or treatment performed as part of the visit.";
  }
  return "This is a line item from the bill. Ask the billing office what service this charge represents and whether it was billed to insurance correctly.";
}

function normalizeAnalysis(raw: unknown, parsedTextCharges: Array<{ name: string; amount: number }>): Analysis {
  const data = (raw ?? {}) as Partial<Omit<Analysis, "audit" | "score">> & { charges?: Partial<Charge>[] };
  const fallbackByName = new Map(parsedTextCharges.map((c) => [c.name.toLowerCase(), c.amount]));

  const charges = (data.charges ?? []).map((charge, index) => {
    const fallbackAmount =
      (typeof charge.name === "string" ? fallbackByName.get(charge.name.toLowerCase()) : undefined) ??
      parsedTextCharges[index]?.amount ??
      0;

    const parsedAmount =
      typeof charge.amount === "number" && Number.isFinite(charge.amount) && charge.amount > 0
        ? charge.amount
        : fallbackAmount;

    const name = typeof charge.name === "string" ? charge.name : parsedTextCharges[index]?.name ?? `Charge ${index + 1}`;
    const category = typeof charge.category === "string" ? charge.category : "Other";
    const explanation =
      typeof charge.explanation === "string" && charge.explanation.trim() && charge.explanation.trim().toLowerCase() !== "string"
        ? charge.explanation
        : fallbackExplanation(name, category);

    return { name, amount: parsedAmount, category, explanation };
  });

  const normalizedCharges: Charge[] = charges.length > 0
    ? charges
    : parsedTextCharges.map((c) => ({
        name: c.name,
        amount: c.amount,
        category: "Other",
        explanation: fallbackExplanation(c.name, "Other"),
      }));

  const totalFromCharges = normalizedCharges.reduce<number>((sum, c) => sum + c.amount, 0);
  const aiTotal = typeof data.total === "number" && Number.isFinite(data.total) && data.total > 0 ? data.total : 0;

  let normalizedIssues: Issue[] = Array.isArray(data.issues)
    ? data.issues.map((issue) => {
        const rawType = typeof issue.type === "string" ? issue.type.toLowerCase().replace(/\s+/g, "_") : "unclear";
        const type = ALLOWED_ISSUE_TYPES.has(rawType) ? rawType : "unclear";
        const severity = issue.severity === "warning" ? "warning" : "info";
        return {
          type,
          description: typeof issue.description === "string" ? issue.description : "This item may need review.",
          severity,
          relatedCharges: Array.isArray(issue.relatedCharges)
            ? issue.relatedCharges.filter((item): item is string => typeof item === "string")
            : undefined,
        };
      })
    : [];

  const preliminaryAudit = auditBill(normalizedCharges, normalizedIssues);
  const existingIssueKeys = new Set(normalizedIssues.map((issue) => `${issue.type}|${issue.description}`));
  const auditIssues: Issue[] = [
    ...preliminaryAudit.benchmarkedCharges
      .filter((hit) => hit.severity !== "ok" && hit.potentialSavings > 0)
      .map((hit) => ({
        type: "high_cost",
        severity: hit.severity === "high" ? ("warning" as const) : ("info" as const),
        description: `${hit.chargeName} is ${hit.multiple}x above the benchmark high for ${hit.benchmarkName} ($${hit.low.toLocaleString("en-US")}–$${hit.high.toLocaleString("en-US")}). Ask whether this can be adjusted toward the benchmark range.`,
        relatedCharges: [hit.chargeName],
      })),
    ...preliminaryAudit.duplicateGroups.map((group) => ({
      type: "duplicate",
      severity: "warning" as const,
      description: `These charges look like possible duplicates. Ask billing to confirm whether each line represents a separate service.`,
      relatedCharges: group.names,
    })),
    ...preliminaryAudit.vagueCharges.slice(0, 3).map((name) => ({
      type: "vague",
      severity: "info" as const,
      description: `${name} is vague — ask for the exact CPT code, service date, and reason it appears on the bill.`,
      relatedCharges: [name],
    })),
  ].filter((issue) => !existingIssueKeys.has(`${issue.type}|${issue.description}`));
  normalizedIssues = [...normalizedIssues, ...auditIssues].slice(0, 12);

  const finalAudit = auditBill(normalizedCharges, normalizedIssues);

  return {
    summary: typeof data.summary === "string" ? data.summary : "Here is a breakdown of the bill you provided.",
    charges: normalizedCharges,
    total: aiTotal || totalFromCharges,
    issues: normalizedIssues,
    questions: Array.isArray(data.questions) ? data.questions.filter((q): q is string => typeof q === "string") : [],
    score: finalAudit.score,
    audit: finalAudit,
  };
}

/* ── System prompt ────────────────────────────────────────────────────────── */

const SYSTEM_PROMPT = `You are Dose, a compassionate medical billing guide helping patients understand their healthcare bills in plain, friendly language.

CORE RULES:
- Never say a charge is definitely wrong. Use phrases like "possible duplicate", "may be unusually high", "worth asking about".
- Explain every charge in 2-3 friendly sentences a non-expert can understand.
- Be calm and reassuring.
- Extract and preserve exact dollar amounts.
- Generate at least 5 specific, actionable questions.

CATEGORIES - assign exactly one:
"Facility Fee" | "Professional Fee" | "Laboratory" | "Imaging" | "Medication" | "Procedure" | "Administrative" | "Other"

ISSUE TYPES - use exactly one string:
"duplicate" | "high_cost" | "vague" | "unclear" | "repeated_fee"

SEVERITY: "warning" | "info"

Respond ONLY with valid JSON, no markdown, no code fences:
{
  "summary": "2-3 friendly sentences summarizing the bill.",
  "charges": [{ "name": "string", "amount": 0, "category": "string", "explanation": "string" }],
  "total": 0,
  "issues": [{ "type": "string", "description": "string", "severity": "warning", "relatedCharges": ["string"] }],
  "questions": ["string"]
}`;

/* ── Routes ───────────────────────────────────────────────────────────────── */

router.post("/ai-analyze", async (req: AuthedRequest, res) => {
  const parsed = AiAnalyzeBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });

  const { rawText, imageBase64, imageMediaType } = parsed.data;

  if (!rawText && !imageBase64) {
    return res.status(400).json({ error: "Provide rawText or imageBase64." });
  }

  if (!process.env.GROQ_API_KEY) {
    if (rawText) {
      const parsedTextCharges = parseTextCharges(rawText);
      const items = parseBillText(rawText);
      const total = billTotal(items);
      const charges: Charge[] = parsedTextCharges.length > 0
        ? parsedTextCharges.map((c) => ({ name: c.name, amount: c.amount, category: "Other", explanation: fallbackExplanation(c.name, "Other") }))
        : items.map((it) => ({ name: it.description, amount: it.amount, category: "Other", explanation: it.explanation }));
      const issues: Issue[] = items.flatMap((it) => it.flags.map((f) => ({ type: f.type, description: f.message, severity: "warning" as const })));
      const audit = auditBill(charges, issues);
      return res.json({
        analysis: {
          summary: "Bill parsed using basic analysis (AI not available).",
          charges,
          total,
          issues,
          questions: ["Has my insurance been billed correctly?", "Are there any duplicate charges?", "Can I get an itemized breakdown?"],
          score: audit.score,
          audit,
        },
      });
    }
    return res.status(500).json({ error: "GROQ_API_KEY not configured" });
  }

  const parsedTextCharges = rawText ? parseTextCharges(rawText) : [];

  try {
    let messages: Parameters<typeof groqChat>[0]["messages"];

    if (imageBase64) {
      const mediaType = (imageMediaType || "image/jpeg") as "image/jpeg" | "image/png" | "image/gif" | "image/webp";
      messages = [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "image_url" as const,
              image_url: { url: `data:${mediaType};base64,${imageBase64}` },
            },
            {
              type: "text" as const,
              text: rawText
                ? `Read the medical bill image. The user also typed this extra context:\n${rawText}\nReturn ONLY one valid JSON object matching the schema.`
                : "Read all charges from this medical bill image and return ONLY one valid JSON object matching the required schema with exact charge amounts.",
            },
          ],
        },
      ];
    } else {
      messages = [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Analyze this medical bill and return the JSON breakdown. Preserve exact dollar amounts.\n\n${rawText}` },
      ];
    }

    const completion = await groqChat(
      { messages, temperature: 0.3, max_tokens: 4096, ...(!imageBase64 && { response_format: { type: "json_object" as const } }) },
      { vision: !!imageBase64 },
    );

    const raw = completion.choices[0]?.message?.content ?? "";
    let parsedResult: unknown;
    try {
      parsedResult = robustParse(raw);
    } catch {
      parsedResult = await repairJsonResponse(raw);
    }

    const analysis = normalizeAnalysis(parsedResult, parsedTextCharges);
    return res.json({ analysis });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "AI analysis failed";
    console.error("[bills/ai-analyze]", msg);
    return res.status(500).json({ error: msg });
  }
});

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

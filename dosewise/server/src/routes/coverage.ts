import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../auth.ts";
import { groqChat } from "../lib/groqHelper.ts";

const router = Router();
router.use(requireAuth);

const Body = z.object({
  coverageType: z.string().max(50).optional(),
  age: z.string().max(10).optional(),
  state: z.string().max(30).optional(),
  zip: z.string().max(10).optional(),
  householdSize: z.string().max(10).optional(),
  employmentStatus: z.string().max(200).optional(),
  income: z.string().max(50).optional(),
  monthlyBudget: z.string().max(50).optional(),
  insuranceStatus: z.string().max(100).optional(),
  currentPlan: z.string().max(200).optional(),
  careNeeds: z.string().max(500).optional(),
  prescriptions: z.string().max(300).optional(),
  denialOrBill: z.string().max(500).optional(),
});

const SYSTEM_PROMPT = `You are Dose, a health insurance navigation guide for people in the United States.

Your job is to help users understand likely coverage paths, insurance risks, claim denial next steps, and practical questions to ask. You are not a lawyer, broker, insurer, or eligibility system.

Important safety rules:
- Never say the user definitely qualifies for Medicaid, Marketplace subsidies, charity care, or a plan.
- Use "may qualify", "worth checking", and "verify with the insurer or program".
- Do not give legal advice. Be specific and action-oriented.
- For estimated_yearly_scenarios, ALWAYS return a specific dollar range in likely_cost (e.g. "$0–$50", "$200–$800"). Never write vague phrases — give a real estimated range based on their income, state, age, and best-match plan.
- If the user is uninsured or low income, prioritize Medicaid, Marketplace subsidies, hospital financial assistance, FQHC/community clinics, and prescription savings programs.

Return ONLY valid JSON. No markdown. No prose outside JSON.

Schema:
{
  "headline": "short powerful headline",
  "summary": "2-3 sentences in plain English",
  "coverage_paths": [
    {
      "name": "Medicaid / Marketplace / Employer Plan / Charity Care / Community Clinic",
      "match_score": 0,
      "best_for": "short phrase",
      "why_it_fits": "specific explanation",
      "watch_out": "specific risk",
      "next_step": "specific action",
      "website": "official URL"
    }
  ],
  "plan_fit_score": 0,
  "plan_fit_label": "Strong fit / Needs verification / Risky / Not enough info",
  "estimated_yearly_scenarios": [
    { "scenario": "2 urgent care visits + 1 lab panel", "likely_cost": "$0–$80", "note": "why this matters for their situation" }
  ],
  "risk_alerts": [
    {
      "title": "short alert title",
      "severity": "high",
      "detail": "specific issue to verify",
      "question_to_ask": "exact question to ask insurer/provider"
    }
  ],
  "questions_to_ask": ["question 1", "question 2", "question 3"],
  "community_angle": "one sentence explaining how this helps reduce medical debt or care barriers"
}`;

function sanitizeUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:") return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

function inferUrl(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("medicare")) return "https://www.medicare.gov/";
  if (lower.includes("chip")) return "https://www.insurekidsnow.gov/";
  if (lower.includes("medicaid")) return "https://www.medicaid.gov/about-us/where-can-people-get-help-medicaid-chip/index.html";
  if (lower.includes("marketplace") || lower.includes("aca")) return "https://www.healthcare.gov/";
  if (lower.includes("employer")) return "https://www.healthcare.gov/have-job-based-coverage/";
  if (lower.includes("charity") || lower.includes("financial assistance")) return "https://www.cms.gov/medical-bill-rights/help/guides/financial-assistance";
  if (lower.includes("community") || lower.includes("clinic") || lower.includes("fqhc")) return "https://findahealthcenter.hrsa.gov/";
  if (lower.includes("prescription")) return "https://www.medicare.gov/basics/costs/help/drug-costs";
  return "https://www.healthcare.gov/";
}

router.post("/", async (req, res) => {
  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: "GROQ_API_KEY not configured" });
  }

  const parsed = Body.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message });
  }

  const body = parsed.data;
  const hasInput = Object.values(body).some((v) => typeof v === "string" && v.trim());
  if (!hasInput) {
    return res.status(400).json({ error: "Tell us at least one thing about your coverage situation." });
  }

  const isFamilyCoverage = body.coverageType?.trim().toLowerCase() === "family";
  const employmentLabel = isFamilyCoverage ? "Employment statuses by family member" : "Employment status";

  const userMessage = [
    `Coverage type: ${body.coverageType?.trim() || "not specified (assume individual)"}`,
    `Age: ${body.age?.trim() || "(not provided)"}`,
    `State: ${body.state?.trim() || "(not provided)"}`,
    `ZIP / area: ${body.zip?.trim() || "(not provided)"}`,
    `Household size: ${body.householdSize?.trim() || "(not provided)"}`,
    `${employmentLabel}: ${body.employmentStatus?.trim() || "(not provided)"}`,
    `Annual income: ${body.income?.trim() || "(not provided)"}`,
    `Monthly premium budget: ${body.monthlyBudget?.trim() || "(not provided)"}`,
    `Insurance status: ${body.insuranceStatus?.trim() || "(not provided)"}`,
    `Current plan details: ${body.currentPlan?.trim() || "(not provided)"}`,
    `Expected care needs: ${body.careNeeds?.trim() || "(not provided)"}`,
    `Prescriptions: ${body.prescriptions?.trim() || "(not provided)"}`,
    `Claim denial reason: ${body.denialOrBill?.trim() || "(not provided)"}`,
    "",
    "Generate the Coverage Copilot JSON. Make every recommendation highly specific to the age, state, income, employment status, and budget the user provided. If age is 65+ suggest Medicare. If income is very low suggest Medicaid. If employed suggest checking employer plan first. Include a website URL for each coverage path.",
  ].join("\n");

  try {
    const completion = await groqChat({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      temperature: 0.25,
      max_tokens: 2200,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content || "{}";
    const result = JSON.parse(raw) as {
      coverage_paths?: Array<{ name?: string; match_score?: unknown; website?: unknown; [k: string]: unknown }>;
      estimated_yearly_scenarios?: unknown[];
      risk_alerts?: unknown[];
      questions_to_ask?: unknown[];
      plan_fit_score?: unknown;
      [k: string]: unknown;
    };

    if (!Array.isArray(result.coverage_paths)) result.coverage_paths = [];
    if (!Array.isArray(result.estimated_yearly_scenarios)) result.estimated_yearly_scenarios = [];
    if (!Array.isArray(result.risk_alerts)) result.risk_alerts = [];
    if (!Array.isArray(result.questions_to_ask)) result.questions_to_ask = [];
    result.plan_fit_score = Math.max(0, Math.min(100, Number(result.plan_fit_score) || 0));
    result.coverage_paths = result.coverage_paths.slice(0, 5).map((path) => ({
      ...path,
      match_score: Math.max(0, Math.min(100, Number(path.match_score) || 0)),
      website: sanitizeUrl(path.website) || inferUrl(path.name || ""),
    }));

    return res.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Coverage analysis failed";
    console.error("[coverage]", msg);
    return res.status(500).json({ error: msg });
  }
});

export default router;

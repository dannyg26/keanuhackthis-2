import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../auth.ts";
import { groqChat } from "../lib/groqHelper.ts";

const router = Router();
router.use(requireAuth);

const PlaceInput = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  brand: z.string().optional(),
  distance: z.string(),
  open: z.enum(["open", "closed", "unknown"]).optional(),
});

const Body = z.object({
  places: z.array(PlaceInput).max(8),
  insurance: z.string().max(100).optional(),
  triage: z
    .object({
      care_type: z.string(),
      urgency: z.string(),
      reasoning: z.string(),
      symptoms: z.string().optional(),
    })
    .nullable()
    .optional(),
});

const SYSTEM_PROMPT = `Medical care navigator. For each input facility, return one insight object. Output JSON: { "insights": [...] }. The "id" field must match the input id exactly. Never skip a facility.

Per facility, output:
- cost_estimate: realistic US out-of-pocket range. ER > urgent care > primary care > pharmacy.
- wait_estimate: realistic wait. ER long, urgent care medium, primary care by-appt, pharmacy short.
- insurance_match: "in_network" | "likely" | "verify" | "unknown" | "out_of_network". "unknown" if no plan provided.
- insurance_note: 5-10 words explaining match. Empty string if no plan.
- fit_score: 0-100, "best place to go RIGHT NOW". 70 if no patient situation provided.
- fit_reason: under 12 words. "Standard option for this care type" if no situation.

fit_score rules:
1. Open status: when ANY similar-type facility is OPEN, cap closed places at 35.
2. For emergency/urgent: long waits drop score 10-20 pts vs short-wait alternatives.
3. When wait/open is the deciding factor, mention it in fit_reason.

Default if uncertain: cost "$100-300", wait "30-60 min", insurance "unknown", fit 70.`;

router.post("/", async (req, res) => {
  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: "GROQ_API_KEY not configured" });
  }

  const parsed = Body.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message });
  }

  const { places, insurance, triage } = parsed.data;

  if (!places || places.length === 0) {
    return res.json({ insights: [] });
  }

  const now = new Date();
  const dayName = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][now.getDay()];
  const timeStr = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  const contextLines: string[] = [
    `Now: ${dayName} ${timeStr}`,
    `Insurance: ${insurance || "none"}`,
  ];
  if (triage) {
    if (triage.symptoms) contextLines.push(`Symptoms: ${triage.symptoms}`);
    contextLines.push(`Care: ${triage.care_type} (${triage.urgency})`);
  } else {
    contextLines.push("No situation — score ~70");
  }

  const placesBlock = places
    .map((p, i) => {
      const status = p.open === "open" ? "OPEN" : p.open === "closed" ? "CLOSED" : "?";
      return `${i + 1}. id=${p.id} | ${p.name}${p.brand ? ` (${p.brand})` : ""} — ${p.type} — ${p.distance} — [${status}]`;
    })
    .join("\n");

  const userPrompt = `${contextLines.join("\n")}\n\nFacilities:\n${placesBlock}\n\nReturn { "insights": [...] }, one entry per facility, ids preserved.`;

  try {
    const completion = await groqChat({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 1200,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content || "{}";
    const result = JSON.parse(raw) as { insights?: unknown[] };
    const insights = Array.isArray(result.insights) ? result.insights : [];
    return res.json({ insights });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Place insights failed";
    console.error("[place-insights]", msg);
    return res.json({ insights: [] });
  }
});

export default router;

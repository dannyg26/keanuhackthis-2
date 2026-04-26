import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../auth.ts";
import { groqChat } from "../lib/groqHelper.ts";

const router = Router();
router.use(requireAuth);

const Body = z.object({
  symptoms: z.string().min(1).max(2000),
  allergies: z.string().max(500).optional(),
  medications: z.string().max(500).optional(),
  history: z.string().max(500).optional(),
});

const SYSTEM_PROMPT = `You are Dose, a careful, empathetic medical triage guide. Based on the user's symptoms, recommend the most appropriate level of care. You are NOT diagnosing — you are routing them to the right facility.

Care levels:
- "hospital" → ER for life-threatening, severe trauma, stroke/heart attack signs, severe bleeding, severe breathing problems
- "urgent_care" → walk-in for acute non-life-threatening: minor injuries, infections, fevers, sprains, mild asthma, UTIs, stitches
- "primary_care" → schedulable for ongoing issues, refills, follow-ups, mild chronic concerns, preventive
- "pharmacy" → over-the-counter relief for clearly minor symptoms (basic cold, allergies, headache without red flags)

Urgency levels:
- "emergency" → call 911 or go to ER NOW
- "urgent" → seek care within 1-4 hours
- "soon" → seek care within 24-48 hours
- "routine" → schedule when convenient

Return ONLY valid JSON. No markdown. No prose. Match this schema exactly:
{
  "care_type": "urgent_care" | "hospital" | "primary_care" | "pharmacy",
  "urgency": "emergency" | "urgent" | "soon" | "routine",
  "headline": "<one short sentence saying where to go and why>",
  "reasoning": "<2-3 sentences plain English about why this care level>",
  "questions_to_ask": ["q1", "q2", "q3"],
  "what_to_bring": ["item1", "item2", "item3"],
  "red_flags": ["sign1 — go to ER if this happens", "sign2 — go to ER if this happens"],
  "estimated_cost": "<rough cost range, e.g. '$150-400 with insurance'>",
  "otc_recommendations": [
    {
      "name": "<brand name>",
      "generic": "<generic/active ingredient>",
      "what_for": "<what this helps with — under 7 words>",
      "dosage": "<typical adult dose>",
      "typical_price": "<US retail range>",
      "caution": "<optional warning, omit if none>"
    }
  ],
  "self_care_tips": ["actionable tip 1", "actionable tip 2", "actionable tip 3"]
}

Rules:
- If ANY symptom suggests heart attack, stroke, severe bleeding, anaphylaxis, severe head injury, or severe breathing problems → care_type:"hospital", urgency:"emergency"
- Be conservative: when uncertain between two levels, pick the higher one
- "what_to_bring" must include insurance card and ID
- For care_type "hospital" with urgency "emergency": otc_recommendations must be []
- Otherwise always provide 2-4 specific OTC products using real US brand names: Tylenol, Advil, Mucinex, Robitussin DM, Claritin, Zyrtec, Benadryl, Pepto-Bismol, Imodium, etc.`;

router.post("/", async (req, res) => {
  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: "GROQ_API_KEY not configured" });
  }

  const parsed = Body.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message });
  }

  const { symptoms, allergies = "", medications = "", history = "" } = parsed.data;
  const hasProfile = !!(allergies || medications || history);
  const profileBlock = hasProfile
    ? `\n\nPatient profile:\n- Allergies: ${allergies || "none reported"}\n- Current medications: ${medications || "none reported"}\n- Medical history: ${history || "none reported"}\n\nScreen OTC recommendations for interactions with their medications and allergies.`
    : "";

  try {
    const completion = await groqChat({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Symptoms / situation: ${symptoms.trim()}${profileBlock}\n\nReturn the triage JSON.` },
      ],
      temperature: 0.3,
      max_tokens: 1600,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content || "{}";
    const result = JSON.parse(raw) as Record<string, unknown>;

    const validCareTypes = ["urgent_care", "hospital", "primary_care", "pharmacy"];
    const validUrgencies = ["emergency", "urgent", "soon", "routine"];
    if (!validCareTypes.includes(result.care_type as string)) result.care_type = "urgent_care";
    if (!validUrgencies.includes(result.urgency as string)) result.urgency = "soon";
    if (!Array.isArray(result.otc_recommendations)) result.otc_recommendations = [];
    if (!Array.isArray(result.self_care_tips)) result.self_care_tips = [];
    if (!Array.isArray(result.questions_to_ask)) result.questions_to_ask = [];
    if (!Array.isArray(result.what_to_bring)) result.what_to_bring = [];
    if (!Array.isArray(result.red_flags)) result.red_flags = [];

    return res.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Triage failed";
    console.error("[triage]", msg);
    return res.status(500).json({ error: msg });
  }
});

export default router;

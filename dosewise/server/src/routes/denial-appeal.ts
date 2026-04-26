import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../auth.ts";
import { groqChat } from "../lib/groqHelper.ts";
import type { DenialExplainResult } from "./denial-explain.ts";

const router = Router();
router.use(requireAuth);

export interface DenialAppealResult {
  subject_line: string;
  letter_text: string;
}

const Body = z.object({
  denialText: z.string().max(8000).optional(),
  analysis: z.record(z.unknown()),
});

const SYSTEM_PROMPT = `You are a US health insurance patient advocate drafting a concise internal appeal letter for a denied health insurance claim.

Write a professional, firm, factual appeal letter addressed to the insurer's Appeals Department.

Rules:
- Do not invent member IDs, claim numbers, diagnoses, provider names, dates, or dollar amounts.
- Use fill-in placeholders like [Member ID], [Claim Number], and [Date of Service] when details are missing.
- Reference the denial reason and the patient's appeal rights.
- Ask the insurer to reverse the denial, reprocess the claim, provide the plan language used, and explain external appeal rights if upheld.
- Keep the letter ready to print or paste into a portal.

Return ONLY valid JSON:
{
  "subject_line": "short appeal subject",
  "letter_text": "full appeal letter with \\n line breaks"
}`;

function todayLong(): string {
  return new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

router.post("/", async (req, res) => {
  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: "GROQ_API_KEY not configured" });
  }

  const parsed = Body.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message });
  }

  const { denialText, analysis } = parsed.data;
  const a = analysis as Partial<DenialExplainResult>;

  if (!a) {
    return res.status(400).json({ error: "Analyze the denial before creating an appeal." });
  }

  const prompt = `Draft the appeal letter as JSON.

Today's date: ${todayLong()}

Denial reason:
${a.denial_reason || "(not provided)"}

Plain-English explanation:
${a.plain_english || "(not provided)"}

Why this happens:
${a.why_this_happens || "(not provided)"}

Patient rights:
${a.your_rights || "(not provided)"}

Recommended appeal steps:
${Array.isArray(a.appeal_steps) ? a.appeal_steps.map((s, i) => `${i + 1}. ${s}`).join("\n") : "(not provided)"}

Documents to mention as enclosed/requested:
${Array.isArray(a.documents_needed) ? a.documents_needed.map((d) => `- ${d}`).join("\n") : "(not provided)"}

Original denial text/context:
${denialText?.trim() || "(not provided)"}

Now write the appeal letter.`;

  try {
    const completion = await groqChat({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      temperature: 0.35,
      max_tokens: 2200,
      response_format: { type: "json_object" as const },
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const result = JSON.parse(raw) as DenialAppealResult;

    if (!result.letter_text?.trim()) {
      return res.status(500).json({ error: "Appeal generation returned empty content." });
    }
    if (!result.subject_line?.trim()) {
      result.subject_line = "Appeal of denied health insurance claim";
    }

    return res.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Appeal generation failed";
    console.error("[denial-appeal]", msg);
    return res.status(500).json({ error: msg });
  }
});

export default router;

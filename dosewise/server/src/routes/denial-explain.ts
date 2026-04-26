import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../auth.ts";
import { groqChat } from "../lib/groqHelper.ts";

const router = Router();
router.use(requireAuth);

export interface DenialExplainResult {
  denial_reason: string;
  plain_english: string;
  why_this_happens: string;
  your_rights: string;
  appeal_steps: string[];
  documents_needed: string[];
  call_script: string[];
  success_likelihood: "high" | "medium" | "low";
  success_label: string;
}

const Body = z.object({
  text: z.string().max(8000).optional(),
  imageData: z.string().max(5_000_000).optional(),
  imageType: z.string().max(50).optional(),
});

const SYSTEM_PROMPT = `You are a US health insurance patient advocate who specializes in explaining claim denials in plain language and guiding patients through the appeals process.

A patient has uploaded or pasted their insurance claim denial letter or EOB (Explanation of Benefits). Your job is to:
1. Identify the specific denial reason(s) in plain English a non-expert can understand
2. Explain why insurers commonly deny claims for this reason
3. Tell the patient their rights and what they can do
4. Give a clear, numbered appeal action plan
5. List the specific documents they need to gather
6. Provide a word-for-word phone script they can read to the insurer

Important rules:
- Be compassionate and empowering — denials are often successfully appealed
- Never guarantee an appeal will succeed
- Use "may", "typically", "often" not absolutes
- Reference real US patient rights: ACA internal/external appeal rights, No Surprises Act (for surprise bills), ERISA for employer plans, state insurance commissioner as escalation
- Be specific to the denial reason found in the text — do not give generic advice
- If the image or text is unclear, do your best and note what you could not read

Return ONLY valid JSON matching this schema exactly:
{
  "denial_reason": "The specific reason code or phrase found in the denial (quote it if visible)",
  "plain_english": "2-3 sentences explaining what this denial means in everyday language",
  "why_this_happens": "1-2 sentences explaining why insurers commonly deny for this reason",
  "your_rights": "1-2 sentences on the patient's legal rights for this type of denial",
  "appeal_steps": ["Step 1: ...", "Step 2: ...", "Step 3: ..."],
  "documents_needed": ["Document 1", "Document 2", "Document 3"],
  "call_script": ["Say: ...", "Say: ...", "Say: ..."],
  "success_likelihood": "high" | "medium" | "low",
  "success_label": "e.g. Strong appeal case — most denials like this are overturned"
}`;

router.post("/", async (req, res) => {
  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: "GROQ_API_KEY not configured" });
  }

  const parsed = Body.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message });
  }

  const { text, imageData, imageType } = parsed.data;
  if (!text?.trim() && !imageData) {
    return res.status(400).json({ error: "Please paste your denial text or upload the denial letter." });
  }

  const hasImage = !!imageData && (imageType || "image/jpeg").startsWith("image/");

  type UserContent = string | Array<{ type: "image_url"; image_url: { url: string } } | { type: "text"; text: string }>;
  let userContent: UserContent;

  if (hasImage) {
    const mime = imageType || "image/jpeg";
    userContent = [
      { type: "image_url", image_url: { url: `data:${mime};base64,${imageData}` } },
      {
        type: "text",
        text: text?.trim()
          ? `Read the denial letter image. The patient also typed this additional context:\n\n${text}\n\nAnalyze the denial and return the JSON.`
          : "Read this insurance claim denial letter or EOB image and analyze the denial. Return the JSON.",
      },
    ];
  } else {
    userContent = `Analyze this insurance claim denial and return the JSON breakdown.\n\n${text}`;
  }

  try {
    const completion = await groqChat(
      {
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          { role: "user", content: userContent as any },
        ],
        temperature: 0.3,
        max_tokens: 2400,
        ...(!hasImage && { response_format: { type: "json_object" as const } }),
      },
      { vision: hasImage },
    );

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let result: DenialExplainResult;
    try {
      const cleaned = raw.replace(/^```(?:json)?\s*/m, "").replace(/\s*```\s*$/m, "").trim();
      result = JSON.parse(cleaned) as DenialExplainResult;
    } catch {
      return res.status(500).json({ error: "Could not parse AI response. Please try again." });
    }

    if (!["high", "medium", "low"].includes(result.success_likelihood)) result.success_likelihood = "medium";
    if (!Array.isArray(result.appeal_steps)) result.appeal_steps = [];
    if (!Array.isArray(result.documents_needed)) result.documents_needed = [];
    if (!Array.isArray(result.call_script)) result.call_script = [];

    return res.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Denial analysis failed";
    console.error("[denial-explain]", msg);
    return res.status(500).json({ error: msg });
  }
});

export default router;

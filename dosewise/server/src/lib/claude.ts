import Anthropic from "@anthropic-ai/sdk";

const apiKey = process.env.ANTHROPIC_API_KEY;
const client = apiKey ? new Anthropic({ apiKey }) : null;

const SYSTEM_PROMPT = `You are Dose, a calm, friendly healthcare companion inside the DoseWise app.

Your job:
- Help the user understand their medications, adherence, bills, and savings.
- Be brief (1–3 sentences). Be warm but never patronizing.
- You do NOT diagnose, prescribe, or replace a clinician.
- For anything urgent or symptom-related, gently suggest contacting a licensed provider.
- When the user asks about specific data, use the context provided.
- Do NOT use emojis. Use plain language and short sentences.`;

export interface CompanionContext {
  riskScore?: number | null;
  riskLevel?: string | null;
  adherencePct?: number | null;
  streakDays?: number | null;
  medications?: string[];
}

export interface CompanionMessage {
  role: "user" | "assistant";
  content: string;
}

function fallbackReply(text: string, ctx: CompanionContext): string {
  const t = text.toLowerCase();
  if (/(risk|score)/.test(t))
    return `Your risk score is ${ctx.riskScore ?? "—"} out of 100${ctx.riskLevel ? ` (${ctx.riskLevel} risk)` : ""}. Open the Risk page if you want me to break it down.`;
  if (/(adherence|streak|dose|miss)/.test(t))
    return `You're at ${ctx.adherencePct ?? 0}% adherence with a ${ctx.streakDays ?? 0}-day streak. Keep it going.`;
  if (/(bill|charge|cost|insurance)/.test(t))
    return `Drop a bill on the Bill Breakdown page and I'll flag duplicates, vague items, and high charges.`;
  if (/(coupon|saving|save|cheap|price)/.test(t))
    return `You have active coupons on the Savings page. Costco is usually the cheapest pharmacy in our sample data.`;
  if (/(pill|medication|med)/.test(t))
    return `Your current meds: ${(ctx.medications ?? []).join(", ") || "none on file"}.`;
  if (/(hello|hi|hey|good morning|good evening)/.test(t))
    return `Hey there. I'm Dose, your healthcare copilot. How can I help today?`;
  if (/(thank|thanks)/.test(t))
    return `You got it. I'm here whenever you need me.`;
  return `I'm not sure I caught that. Try asking about your risk, adherence, bills, savings, or your pills.`;
}

export interface EnrichmentInput {
  name: string;
  genericName?: string;
  dosageForm?: string;
  route?: string;
  activeIngredients?: Array<{ name: string; strength?: string }>;
}
export interface EnrichmentResult {
  purpose: string;
  sideEffects: string[];
  callDoctor: string[];
  provider: "claude" | "fallback";
}

const ENRICH_SYSTEM = `You generate concise patient-education info for a medication.
Return STRICT JSON with this shape — no prose, no markdown:
{
  "purpose": string,            // 1 short sentence, plain English. What the med is commonly used for.
  "sideEffects": string[],      // 4 most common side effects, each 2-5 words
  "callDoctor": string[]        // 4 warning signs that warrant calling a doctor, each 4-10 words
}
Rules:
- Patient-friendly language. No jargon, no diagnoses.
- If the med is unfamiliar, give general guidance based on the drug class or active ingredient.
- Never recommend doses or replace clinician advice.`;

function fallbackEnrichment(input: EnrichmentInput): EnrichmentResult {
  return {
    purpose: input.genericName
      ? `Contains ${input.genericName.toLowerCase()}. Ask your pharmacist for specifics.`
      : "Recently scanned medication. Add details from the label.",
    sideEffects: ["Nausea", "Drowsiness", "Headache", "Upset stomach"],
    callDoctor: [
      "Severe allergic reaction (hives, swelling)",
      "Trouble breathing or chest pain",
      "Symptoms get worse, not better",
      "Unusual or persistent side effects",
    ],
    provider: "fallback",
  };
}

export async function enrichMedication(input: EnrichmentInput): Promise<EnrichmentResult> {
  if (!client) return fallbackEnrichment(input);

  const ingredients = (input.activeIngredients ?? [])
    .map(i => `${i.name}${i.strength ? ` (${i.strength})` : ""}`)
    .join(", ");
  const promptBody = [
    `Medication name: ${input.name}`,
    input.genericName ? `Generic name: ${input.genericName}` : null,
    input.dosageForm ? `Dosage form: ${input.dosageForm}` : null,
    input.route ? `Route: ${input.route}` : null,
    ingredients ? `Active ingredients: ${ingredients}` : null,
  ].filter(Boolean).join("\n");

  try {
    const resp = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      system: ENRICH_SYSTEM,
      messages: [{ role: "user", content: promptBody }],
    });
    const block = resp.content.find(b => b.type === "text");
    const text = block && "text" in block ? block.text.trim() : "";
    // Strip code fences if Claude added them despite instructions.
    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
    const parsed = JSON.parse(cleaned);
    return {
      purpose: typeof parsed.purpose === "string" ? parsed.purpose : "",
      sideEffects: Array.isArray(parsed.sideEffects) ? parsed.sideEffects.filter((s: unknown) => typeof s === "string") : [],
      callDoctor: Array.isArray(parsed.callDoctor) ? parsed.callDoctor.filter((s: unknown) => typeof s === "string") : [],
      provider: "claude",
    };
  } catch (err) {
    console.error("Claude enrichment failed, falling back:", err);
    return fallbackEnrichment(input);
  }
}

export async function companionReply(
  history: CompanionMessage[],
  context: CompanionContext,
): Promise<{ reply: string; provider: "claude" | "fallback" }> {
  const lastUser = [...history].reverse().find(m => m.role === "user")?.content ?? "";

  if (!client) {
    return { reply: fallbackReply(lastUser, context), provider: "fallback" };
  }

  const ctxBlock = `User context:
- Risk score: ${context.riskScore ?? "n/a"} (${context.riskLevel ?? "n/a"})
- Adherence: ${context.adherencePct ?? "n/a"}%
- Streak: ${context.streakDays ?? 0} days
- Medications: ${(context.medications ?? []).join(", ") || "none on file"}`;

  try {
    const resp = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 220,
      system: [
        { type: "text", text: SYSTEM_PROMPT },
        { type: "text", text: ctxBlock, cache_control: { type: "ephemeral" } },
      ],
      messages: history.slice(-12).map(m => ({ role: m.role, content: m.content })),
    });

    const block = resp.content.find(b => b.type === "text");
    const text = block && "text" in block ? block.text.trim() : "";
    return { reply: text || fallbackReply(lastUser, context), provider: "claude" };
  } catch (err) {
    console.error("Claude API failed, falling back:", err);
    return { reply: fallbackReply(lastUser, context), provider: "fallback" };
  }
}

import Groq from "groq-sdk";

const apiKey = process.env.GROQ_API_KEY;
const client = apiKey ? new Groq({ apiKey }) : null;

const MODEL = "llama-3.3-70b-versatile";

const SYSTEM_PROMPT = `You are Dose, a calm, friendly healthcare companion inside the DoseWise app.

Your job:
- Answer the user's CURRENT question directly. Focus only on the medication or topic they just asked about — do not repeat or reference previous answers.
- Use the "Relevant medication data" block when provided — it contains accurate dosing limits and safety info.
- Be specific and helpful. You CAN discuss dosing limits, risks, and safety info for well-known medications.
- Be brief (2–4 sentences). Be warm but never patronizing.
- You do NOT diagnose or prescribe. For personal medical decisions, briefly suggest consulting a provider.
- Do NOT use emojis. Use plain language and short sentences.`;

// Maps keyword → FDA search terms (brand name or generic)
const MED_FDA_TERMS: Record<string, { field: string; term: string }[]> = {
  tylenol:       [{ field: "openfda.brand_name", term: "tylenol" }, { field: "openfda.generic_name", term: "acetaminophen" }],
  acetaminophen: [{ field: "openfda.generic_name", term: "acetaminophen" }],
  advil:         [{ field: "openfda.brand_name", term: "advil" }, { field: "openfda.generic_name", term: "ibuprofen" }],
  ibuprofen:     [{ field: "openfda.generic_name", term: "ibuprofen" }],
  motrin:        [{ field: "openfda.brand_name", term: "motrin" }, { field: "openfda.generic_name", term: "ibuprofen" }],
  aspirin:       [{ field: "openfda.generic_name", term: "aspirin" }],
  aleve:         [{ field: "openfda.brand_name", term: "aleve" }, { field: "openfda.generic_name", term: "naproxen" }],
  naproxen:      [{ field: "openfda.generic_name", term: "naproxen" }],
  benadryl:      [{ field: "openfda.brand_name", term: "benadryl" }, { field: "openfda.generic_name", term: "diphenhydramine" }],
  diphenhydramine: [{ field: "openfda.generic_name", term: "diphenhydramine" }],
  claritin:      [{ field: "openfda.brand_name", term: "claritin" }, { field: "openfda.generic_name", term: "loratadine" }],
  zyrtec:        [{ field: "openfda.brand_name", term: "zyrtec" }, { field: "openfda.generic_name", term: "cetirizine" }],
  melatonin:     [{ field: "openfda.generic_name", term: "melatonin" }],
  pepcid:        [{ field: "openfda.brand_name", term: "pepcid" }, { field: "openfda.generic_name", term: "famotidine" }],
  omeprazole:    [{ field: "openfda.generic_name", term: "omeprazole" }],
  prilosec:      [{ field: "openfda.brand_name", term: "prilosec" }, { field: "openfda.generic_name", term: "omeprazole" }],
  metformin:     [{ field: "openfda.generic_name", term: "metformin" }],
  lisinopril:    [{ field: "openfda.generic_name", term: "lisinopril" }],
  atorvastatin:  [{ field: "openfda.generic_name", term: "atorvastatin" }],
  sertraline:    [{ field: "openfda.generic_name", term: "sertraline" }],
  warfarin:      [{ field: "openfda.generic_name", term: "warfarin" }],
};

type FDALabelResult = Record<string, string[] | undefined>;

async function fetchFDALabel(keyword: string): Promise<string | null> {
  const searches = MED_FDA_TERMS[keyword];
  if (!searches) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);

  try {
    for (const { field, term } of searches) {
      const url = `https://api.fda.gov/drug/label.json?search=${field}:"${encodeURIComponent(term)}"&limit=1`;
      const resp = await fetch(url, { signal: controller.signal });
      if (!resp.ok) continue;

      const data = await resp.json() as { results?: FDALabelResult[] };
      const r = data.results?.[0];
      if (!r) continue;

      const extract = (field: string, max = 250) =>
        r[field]?.[0]?.replace(/\s+/g, " ").trim().slice(0, max) ?? "";

      const parts: string[] = [];
      const purpose = extract("purpose", 200);
      const dosing  = extract("dosage_and_administration", 300);
      const warning = extract("warnings", 250);
      const interactions = extract("drug_interactions", 200);

      if (purpose) parts.push(`Purpose: ${purpose}`);
      if (dosing)  parts.push(`Dosing: ${dosing}`);
      if (warning) parts.push(`Warnings: ${warning}`);
      if (interactions) parts.push(`Interactions: ${interactions}`);

      if (parts.length > 0) {
        clearTimeout(timeout);
        return `FDA label (${term}):\n${parts.join("\n")}`;
      }
    }
    clearTimeout(timeout);
    return null;
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

async function medSafetyBlock(text: string): Promise<string> {
  const t = text.toLowerCase();
  const detected = Object.keys(MED_FDA_TERMS).filter(k => t.includes(k)).slice(0, 2);
  if (detected.length === 0) return "";

  const lines: string[] = [];
  for (const key of detected) {
    const fdaData = await fetchFDALabel(key);
    if (fdaData) lines.push(fdaData);
  }

  return lines.length
    ? `Relevant medication data (FDA):\n${lines.join("\n")}`
    : "";
}

export interface MedicationDetail {
  name: string;
  dosage: string;
  frequency: string;
  purpose: string;
  sideEffects: string[];
}

export interface CompanionContext {
  riskScore?: number | null;
  riskLevel?: string | null;
  adherencePct?: number | null;
  streakDays?: number | null;
  medications?: string[];
  medicationDetails?: MedicationDetail[];
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

export async function enrichMedication(
  input: EnrichmentInput,
): Promise<EnrichmentResult> {
  if (!client) return fallbackEnrichment(input);

  const ingredients = (input.activeIngredients ?? [])
    .map((i) => `${i.name}${i.strength ? ` (${i.strength})` : ""}`)
    .join(", ");
  const promptBody = [
    `Medication name: ${input.name}`,
    input.genericName ? `Generic name: ${input.genericName}` : null,
    input.dosageForm ? `Dosage form: ${input.dosageForm}` : null,
    input.route ? `Route: ${input.route}` : null,
    ingredients ? `Active ingredients: ${ingredients}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const resp = await client.chat.completions.create({
      model: MODEL,
      max_tokens: 400,
      messages: [
        { role: "system", content: ENRICH_SYSTEM },
        { role: "user", content: promptBody },
      ],
    });
    const text = resp.choices[0]?.message?.content?.trim() ?? "";
    const cleaned = text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "");
    const parsed = JSON.parse(cleaned);
    return {
      purpose: typeof parsed.purpose === "string" ? parsed.purpose : "",
      sideEffects: Array.isArray(parsed.sideEffects)
        ? parsed.sideEffects.filter((s: unknown) => typeof s === "string")
        : [],
      callDoctor: Array.isArray(parsed.callDoctor)
        ? parsed.callDoctor.filter((s: unknown) => typeof s === "string")
        : [],
      provider: "claude",
    };
  } catch (err) {
    console.error("Groq enrichment failed, falling back:", err);
    return fallbackEnrichment(input);
  }
}

export async function companionReply(
  currentMessage: string,
  _history: CompanionMessage[],
  context: CompanionContext,
): Promise<{ reply: string; provider: "claude" | "fallback" }> {
  const lastUser = currentMessage;

  if (!client) {
    return { reply: fallbackReply(lastUser, context), provider: "fallback" };
  }

  const medBlock =
    (context.medicationDetails ?? []).length > 0
      ? (context.medicationDetails ?? [])
          .map(
            (m) =>
              `  • ${m.name}${m.dosage ? ` (${m.dosage})` : ""}${m.frequency ? `, ${m.frequency}` : ""}${m.purpose ? ` — ${m.purpose}` : ""}${m.sideEffects.length ? `; side effects: ${m.sideEffects.join(", ")}` : ""}`,
          )
          .join("\n")
      : "  none on file";

  const safetyInfo = await medSafetyBlock(lastUser);

  const ctxBlock = [
    `User context:`,
    `- Risk score: ${context.riskScore ?? "n/a"} (${context.riskLevel ?? "n/a"})`,
    `- Adherence: ${context.adherencePct ?? "n/a"}%`,
    `- Streak: ${context.streakDays ?? 0} days`,
    `- Medications on file:\n${medBlock}`,
    safetyInfo ? `\n${safetyInfo}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const resp = await client.chat.completions.create({
      model: MODEL,
      max_tokens: 300,
      messages: [
        {
          role: "system",
          content: `${SYSTEM_PROMPT}\n\n${ctxBlock}\n\nThe user's current question is: "${lastUser}"\nAnswer ONLY this specific question. Do not reference or repeat anything from earlier in the conversation.`,
        },
        { role: "user", content: lastUser },
      ],
    });

    const text = resp.choices[0]?.message?.content?.trim() ?? "";
    return {
      reply: text || fallbackReply(lastUser, context),
      provider: "claude",
    };
  } catch (err) {
    console.error("Groq API failed, falling back:", err);
    return { reply: fallbackReply(lastUser, context), provider: "fallback" };
  }
}

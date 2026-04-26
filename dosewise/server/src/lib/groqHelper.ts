import Groq from "groq-sdk";
import Anthropic from "@anthropic-ai/sdk";
import type { ChatCompletionCreateParamsNonStreaming, ChatCompletionMessageParam } from "groq-sdk/resources/chat/completions";

const GROQ_MODEL_CHAIN = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "meta-llama/llama-4-scout-17b-16e-instruct",
];

export const VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

let _groq: Groq | null = null;
function getGroq(): Groq | null {
  if (!process.env.GROQ_API_KEY) return null;
  if (!_groq) _groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return _groq;
}

let _anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}

function isSkippable(err: unknown): boolean {
  const e = err as { status?: number; message?: string };
  if (e?.status === 429 || e?.status === 404) return true;
  const msg = e?.message ?? "";
  return /rate.?limit|quota|model.*not found|decommissioned|developer mode/i.test(msg);
}

function groqMessagesToAnthropic(messages: ChatCompletionMessageParam[]): {
  system: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
} {
  const sysMessages = messages.filter((m) => m.role === "system");
  const system = sysMessages.map((m) => (typeof m.content === "string" ? m.content : "")).join("\n\n");
  const rest = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
    }));
  // Anthropic requires at least one user message
  if (rest.length === 0) rest.push({ role: "user", content: "Please respond." });
  return { system, messages: rest };
}

async function tryAnthropic(
  params: Omit<ChatCompletionCreateParamsNonStreaming, "model">,
): Promise<{ choices: Array<{ message: { content: string } }> }> {
  const client = getAnthropic();
  if (!client) throw new Error("No ANTHROPIC_API_KEY set");

  const { system, messages } = groqMessagesToAnthropic(
    params.messages as ChatCompletionMessageParam[],
  );

  const resp = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: params.max_tokens ?? 1024,
    system: system || undefined,
    messages,
  });

  const text = resp.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  return { choices: [{ message: { content: text } }] };
}

export async function groqChat(
  params: Omit<ChatCompletionCreateParamsNonStreaming, "model">,
  { vision = false }: { vision?: boolean } = {},
) {
  const groq = getGroq();
  const chain = groq
    ? vision
      ? [VISION_MODEL, ...GROQ_MODEL_CHAIN.filter((m) => m !== VISION_MODEL)]
      : GROQ_MODEL_CHAIN
    : [];

  let lastErr: unknown;

  for (const model of chain) {
    try {
      return await groq!.chat.completions.create({ ...params, model });
    } catch (err) {
      lastErr = err;
      if (isSkippable(err)) {
        console.warn(`[groq] ${model} skipped:`, (err as Error).message?.slice(0, 80));
        continue;
      }
      throw err;
    }
  }

  // All Groq models failed — try Claude (Anthropic) as final fallback
  console.warn("[groq] All Groq models failed, falling back to Claude Haiku");
  try {
    return await tryAnthropic(params);
  } catch (err) {
    lastErr = err;
    console.error("[groq] Claude fallback also failed:", (err as Error).message?.slice(0, 80));
  }

  throw lastErr;
}

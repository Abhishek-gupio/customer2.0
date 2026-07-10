import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../config/env";
import { logger } from "../config/logger";
import { groqClient } from "../services/ai-provider.service";

/**
 * Model Router — one place that decides which provider handles which *kind* of AI call,
 * instead of that decision being implicit in whichever service happens to call which SDK.
 *
 * Deliberately no cross-provider fallback: each capability is pinned to exactly one provider.
 * If that provider isn't configured or the call fails, this throws rather than silently
 * spending money on a different provider — a cost-predictability choice, not an oversight.
 * (Contrast with `ai-provider.service.ts`'s `callAI()`, which still does Groq→Gemini fallback
 * for its own callers — that function is untouched; this is a separate, stricter entry point
 * for the agent pipeline specifically.)
 */
export type ModelCapability = "text" | "vision" | "embedding";

const CAPABILITY_PROVIDER: Record<ModelCapability, "groq" | "gemini"> = {
  text: "groq",
  vision: "gemini",
  embedding: "gemini",
};

export function routingFor(capability: ModelCapability): "groq" | "gemini" {
  return CAPABILITY_PROVIDER[capability];
}

const GROQ_TEXT_MODEL = "llama-3.1-8b-instant";
const GEMINI_VISION_MODEL = "gemini-2.5-flash";
const GEMINI_EMBED_MODEL = "gemini-embedding-001";
const GEMINI_EMBED_API = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_EMBED_MODEL}:embedContent`;

let geminiSdkClient: GoogleGenerativeAI | null = null;
function geminiSdk(): GoogleGenerativeAI | null {
  if (!env.GEMINI_API_KEY) return null;
  if (!geminiSdkClient) geminiSdkClient = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  return geminiSdkClient;
}

export interface RouteTextOptions {
  temperature?: number;
  maxOutputTokens?: number;
}

/** Text capability -> Groq only. Throws if GROQ_API_KEY is missing or the call fails. */
export async function routeText(prompt: string, systemPrompt?: string, options?: RouteTextOptions): Promise<string> {
  const groq = groqClient();
  if (!groq) {
    throw new Error("Model Router: 'text' is routed to Groq, but GROQ_API_KEY is not configured.");
  }
  const res = await groq.chat.completions.create({
    model: GROQ_TEXT_MODEL,
    messages: [
      ...(systemPrompt ? [{ role: "system" as const, content: systemPrompt }] : []),
      { role: "user" as const, content: prompt },
    ],
    max_tokens: options?.maxOutputTokens ?? 1024,
    ...(options?.temperature != null ? { temperature: options.temperature } : {}),
  });
  const text = res.choices[0]?.message?.content ?? "";
  if (!text) throw new Error("Model Router: Groq returned an empty response.");
  return text;
}

/** Vision capability -> Gemini only. Throws if GEMINI_API_KEY is missing or the call fails. */
export async function routeVision(prompt: string, imageBuffer: Buffer, mimeType: string): Promise<string> {
  const gemini = geminiSdk();
  if (!gemini) {
    throw new Error("Model Router: 'vision' is routed to Gemini, but GEMINI_API_KEY is not configured.");
  }
  const model = gemini.getGenerativeModel({ model: GEMINI_VISION_MODEL });
  const result = await model.generateContent([
    { text: prompt },
    { inlineData: { data: imageBuffer.toString("base64"), mimeType } },
  ]);
  return result.response.text();
}

/** Embedding capability -> Gemini only. Returns null (not a throw) on failure — callers already treat a missing embedding as "skip this document" rather than a hard error. */
export async function routeEmbedding(text: string): Promise<number[] | null> {
  const key = env.GEMINI_API_KEY;
  if (!key || !text) {
    logger.warn("Model Router: 'embedding' is routed to Gemini, but GEMINI_API_KEY is not configured.");
    return null;
  }
  try {
    const res = await fetch(`${GEMINI_EMBED_API}?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: { parts: [{ text }] } }),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`${res.status} ${res.statusText}: ${errText.slice(0, 200)}`);
    }
    const data = (await res.json()) as { embedding?: { values?: number[] } };
    return data.embedding?.values?.length ? data.embedding.values : null;
  } catch (err) {
    logger.error({ err }, "Model Router: embedding call failed");
    return null;
  }
}

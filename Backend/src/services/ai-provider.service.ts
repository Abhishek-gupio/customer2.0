import { GoogleGenAI } from "@google/genai";
import Groq from "groq-sdk";
import fs from "fs";
import path from "path";
import { env } from "../config/env";
import { logger } from "../config/logger";

/**
 * Shared low-level text-AI client: tries Groq first (fast, but a small free-tier budget
 * shared across the whole app), falls back to Gemini (bigger per-request headroom, but a
 * small requests/day cap on the free tier) with one retry on transient errors.
 *
 * Only for plain prompt-in/text-out calls. NOT for image/audio inputs (Groq's text model
 * can't read them), embeddings, or the main chat agent (tool-calling/streaming/context
 * caching) — those keep calling @google/generative-ai directly.
 */

const GROQ_MODEL = "llama-3.1-8b-instant"; // free, very fast, small free-tier quota
const GEMINI_MODEL = "gemini-2.5-flash"; // fallback

type AIOptions = {
  temperature?: number;
  maxOutputTokens?: number;
};

export function groqClient(): Groq | null {
  if (!env.GROQ_API_KEY) return null;
  return new Groq({ apiKey: env.GROQ_API_KEY });
}

export function geminiClient(): GoogleGenAI | null {
  if (!env.GEMINI_API_KEY) return null;
  return new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
}

function isRetryableAIError(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  const message = (err as { message?: string })?.message || "";
  return status === 503 || status === 429 || /UNAVAILABLE|high demand|rate.?limit/i.test(message);
}

async function callGeminiRaw(prompt: string, systemPrompt?: string, options?: AIOptions): Promise<string> {
  const gemini = geminiClient();
  if (!gemini) throw new Error("No AI provider configured. Set GROQ_API_KEY or GEMINI_API_KEY.");
  const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;
  const response = await gemini.models.generateContent({
    model: GEMINI_MODEL,
    contents: fullPrompt,
    ...(options?.temperature != null || options?.maxOutputTokens != null
      ? {
          config: {
            ...(options.temperature != null ? { temperature: options.temperature } : {}),
            ...(options.maxOutputTokens != null ? { maxOutputTokens: options.maxOutputTokens } : {}),
          },
        }
      : {}),
  });
  return response.text ?? "";
}

// One retry on a transient failure (e.g. "high demand" 503s) — these are momentary
// capacity blips that usually succeed a couple seconds later. This does NOT help with a
// 429 caused by a daily/monthly quota being exhausted (only per-minute rate limits or
// momentary outages).
async function callGeminiWithRetry(prompt: string, systemPrompt?: string, options?: AIOptions): Promise<string> {
  try {
    return await callGeminiRaw(prompt, systemPrompt, options);
  } catch (err) {
    if (!isRetryableAIError(err)) throw err;
    logger.warn({ err: (err as Error).message }, "[AI] Gemini failed with a transient error, retrying once");
    await new Promise((resolve) => setTimeout(resolve, 2000));
    return await callGeminiRaw(prompt, systemPrompt, options);
  }
}

export async function callAI(prompt: string, systemPrompt?: string, options?: AIOptions): Promise<string> {
  const groq = groqClient();
  if (groq) {
    try {
      const res = await groq.chat.completions.create({
        model: GROQ_MODEL,
        messages: [
          ...(systemPrompt ? [{ role: "system" as const, content: systemPrompt }] : []),
          { role: "user" as const, content: prompt },
        ],
        max_tokens: options?.maxOutputTokens ?? 1024,
        ...(options?.temperature != null ? { temperature: options.temperature } : {}),
      });
      const text = res.choices[0]?.message?.content ?? "";
      if (text) return text;
    } catch (err) {
      logger.warn({ err: (err as Error).message }, "[AI] Groq failed, falling back to Gemini");
    }
  }
  return callGeminiWithRetry(prompt, systemPrompt, options);
}

/**
 * For prompts already known to be too large for Groq's free-tier per-minute budget (e.g.
 * whole documents) — skip straight to Gemini instead of a guaranteed-to-fail call.
 */
export async function callAIForLargeContent(prompt: string, systemPrompt?: string, options?: AIOptions): Promise<string> {
  return callGeminiWithRetry(prompt, systemPrompt, options);
}

/** True if at least one text-AI provider (Groq or Gemini) is configured. */
export function isAIConfigured(): boolean {
  return Boolean(env.GROQ_API_KEY || env.GEMINI_API_KEY);
}

/**
 * Transcribe audio using Groq Whisper (fast), falling back to Gemini if needed.
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  originalName: string,
  mimeType?: string,
): Promise<string> {
  const groq = groqClient();
  if (groq) {
    const tempDir = path.resolve(env.UPLOAD_DIR || "uploads", "temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    const ext = path.extname(originalName) || ".wav";
    const tempFilePath = path.join(tempDir, `transcription-${Date.now()}${ext}`);
    
    try {
      fs.writeFileSync(tempFilePath, audioBuffer);
      const response = await groq.audio.transcriptions.create({
        file: fs.createReadStream(tempFilePath),
        model: "whisper-large-v3",
      });
      if (response.text) {
        return response.text.trim();
      }
    } catch (err) {
      logger.warn({ err: (err as Error).message }, "[AI] Groq Whisper failed, falling back to Gemini for transcription");
    } finally {
      try {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      } catch (err) {
        logger.error({ err }, "Failed to delete temp audio file");
      }
    }
  }

  const gemini = geminiClient();
  if (!gemini) {
    throw new Error("No AI provider configured for audio transcription. Set GROQ_API_KEY or GEMINI_API_KEY.");
  }
  
  const response = await gemini.models.generateContent({
    model: GEMINI_MODEL,
    contents: [
      {
        inlineData: {
          data: audioBuffer.toString("base64"),
          mimeType: mimeType || "audio/wav",
        },
      },
      "Transcribe this audio recording exactly. Provide ONLY the transcribed text, nothing else.",
    ],
  });

  return response.text?.trim() ?? "";
}

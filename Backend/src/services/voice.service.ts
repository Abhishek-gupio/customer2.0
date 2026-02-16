import * as googleTTS from "google-tts-api";
import { logger } from "../config/logger";

/**
 * VOICE SERVICE
 * =============
 * Converts AI text responses into high-quality audio URLs.
 * Supports Multilingual Text-to-Speech (English, Hindi, etc.)
 */
export const voiceService = {
    /**
     * Generates a playable audio URL for a given text.
     * Automatically detects if the text is Hindi or English for best accent.
     */
    async generateSpeechUrl(text: string, langHint: "en" | "hi" | "auto" = "auto"): Promise<string | null> {
        if (!text) return null;

        try {
            // Simple language detection: if contains Hindi characters, use 'hi'
            let lang = "en";
            if (langHint === "hi" || (langHint === "auto" && /[\u0900-\u097F]/.test(text))) {
                lang = "hi-IN";
            } else {
                lang = "en-IN"; // English with Indian accent for Gupio
            }

            // google-tts-api generates a public URL to the audio file
            // Note: Limit is 200 characters for the free API. 
            // We take the first sentence or first 200 chars for the voice briefing.
            const cleanText = text.length > 200 ? text.substring(0, 197) + "..." : text;

            const url = googleTTS.getAudioUrl(cleanText, {
                lang: lang,
                slow: false,
                host: "https://translate.google.com",
            });

            return url;
        } catch (error) {
            logger.error({ error, text }, "Failed to generate speech URL");
            return null;
        }
    }
};

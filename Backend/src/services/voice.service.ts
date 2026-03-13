import * as googleTTS from "google-tts-api";
import axios from "axios";
import { logger } from "../config/logger";
import { env } from "../config/env";

/**
 * VOICE SERVICE — Enhanced with Google Cloud TTS
 * ================================================
 * Converts AI text responses into high-quality audio URLs.
 * Supports Multilingual Text-to-Speech (English, Hindi, etc.)
 *
 * If GOOGLE_CLOUD_TTS_KEY is set → uses Cloud TTS (unlimited length, Wavenet voices)
 * Otherwise → falls back to free google-tts-api (200 char limit)
 */
export const voiceService = {
  /**
   * Main entry point — auto-selects between Cloud TTS and free TTS
   */
  async generateSpeechUrl(
    text: string,
    langHint: "en" | "hi" | "auto" = "auto",
  ): Promise<string | null> {
    if (!text) return null;

    // Detect language
    const isHindi =
      langHint === "hi" ||
      (langHint === "auto" && /[\u0900-\u097F]/.test(text));

    // Try Cloud TTS first if configured
    if (env.GOOGLE_CLOUD_TTS_KEY) {
      try {
        return await this.generateCloudTTS(text, isHindi);
      } catch (error) {
        logger.error({ error }, "Cloud TTS failed, falling back to free TTS");
      }
    }

    // Fallback: free google-tts-api (200 char limit)
    return this.generateFreeTTS(text, isHindi);
  },

  /**
   * Google Cloud Text-to-Speech — high quality, no character limit
   * Uses Wavenet voices for natural-sounding speech
   */
  async generateCloudTTS(
    text: string,
    isHindi: boolean,
  ): Promise<string | null> {
    const apiKey = env.GOOGLE_CLOUD_TTS_KEY;
    if (!apiKey) return null;

    try {
      const voice = isHindi
        ? { languageCode: "hi-IN", name: "hi-IN-Wavenet-A" }
        : { languageCode: "en-IN", name: "en-IN-Wavenet-B" };

      const response = await axios.post(
        `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
        {
          input: { text },
          voice,
          audioConfig: {
            audioEncoding: "MP3",
            speakingRate: 1.0,
            pitch: 0.0,
          },
        },
      );

      if (response.data?.audioContent) {
        // Return as a base64 data URL that can be played directly
        return `data:audio/mp3;base64,${response.data.audioContent}`;
      }

      return null;
    } catch (error) {
      logger.error({ error }, "Google Cloud TTS request failed");
      throw error; // Let caller handle fallback
    }
  },

  /**
   * Free google-tts-api — 200 character limit, lower quality
   */
  generateFreeTTS(text: string, isHindi: boolean): string | null {
    try {
      const lang = isHindi ? "hi-IN" : "en-IN";

      // Truncate for the free API limit
      const cleanText =
        text.length > 200 ? text.substring(0, 197) + "..." : text;

      const url = googleTTS.getAudioUrl(cleanText, {
        lang,
        slow: false,
        host: "https://translate.google.com",
      });

      return url;
    } catch (error) {
      logger.error({ error, text }, "Failed to generate free speech URL");
      return null;
    }
  },
};

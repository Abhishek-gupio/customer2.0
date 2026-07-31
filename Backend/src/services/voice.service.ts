import * as googleTTS from "google-tts-api";
import axios from "axios";
import { logger } from "../config/logger";
import { env } from "../config/env";
import { transcribeAudio, callAI } from "./ai-provider.service";
import { Intent } from "../utils/intentSchema";
import { aiService } from "./ai.service";

export const voiceService = {
  /**
   * Main entry point for Text-to-Speech (TTS) — auto-selects between Cloud TTS and free TTS
   */
  async generateSpeechUrl(
    text: string,
    langHint: string = "auto",
  ): Promise<string | null> {
    if (!text) return null;

    // Detect language
    let lang = "en-IN";
    if (langHint && langHint !== "auto" && langHint !== "en" && langHint !== "hi") {
      lang = langHint;
    } else {
      const normalizedHint = String(langHint).toLowerCase();
      if (normalizedHint === "hi") {
        lang = "hi-IN";
      } else if (normalizedHint === "en") {
        lang = "en-IN";
      } else {
        if (/[\u0C80-\u0CFF]/.test(text)) lang = "kn-IN";
        else if (/[\u0C00-\u0C7F]/.test(text)) lang = "te-IN";
        else if (/[\u0B80-\u0BFF]/.test(text)) lang = "ta-IN";
        else if (/[\u0D00-\u0D7F]/.test(text)) lang = "ml-IN";
        else if (/[\u0980-\u09FF]/.test(text)) lang = "bn-IN";
        else if (/[\u0A80-\u0AFF]/.test(text)) lang = "gu-IN";
        else if (/[\u0A00-\u0A7F]/.test(text)) lang = "pa-IN";
        else if (/[\u0900-\u097F]/.test(text)) lang = "hi-IN"; // Hindi, Marathi, etc.
      }
    }

    // Try Cloud TTS first if configured
    if (env.GOOGLE_CLOUD_TTS_KEY || (env as any).GOOGLE_TTS_API_KEY || (env as any).GOOGLE_MAPS_API_KEY || env.GEMINI_API_KEY) {
      try {
        const cloudAudio = await this.generateCloudTTS(text, lang);
        if (cloudAudio) return cloudAudio;
      } catch (error) {
        logger.error({ error }, "Cloud TTS failed, falling back to free TTS");
      }
    }

    // Fallback: free google-tts-api (200 char limit)
    return this.generateFreeTTS(text, lang);
  },

  /**
   * Google Cloud Text-to-Speech — high quality, no character limit
   * Uses Wavenet or Standard voices for natural-sounding speech
   */
  async generateCloudTTS(
    text: string,
    lang: string,
  ): Promise<string | null> {
    const apiKey = env.GOOGLE_CLOUD_TTS_KEY || (env as any).GOOGLE_TTS_API_KEY || (env as any).GOOGLE_MAPS_API_KEY || env.GEMINI_API_KEY;
    if (!apiKey) return null;

    try {
      let voiceName = "en-IN-Neural2-A";
      if (lang === "hi-IN") voiceName = "hi-IN-Neural2-A";
      else if (lang === "kn-IN") voiceName = "kn-IN-Standard-A";
      else if (lang === "te-IN") voiceName = "te-IN-Standard-A";
      else if (lang === "ta-IN") voiceName = "ta-IN-Wavenet-A";
      else if (lang === "ml-IN") voiceName = "ml-IN-Standard-A";
      else if (lang === "mr-IN") voiceName = "mr-IN-Wavenet-A";
      else if (lang === "bn-IN") voiceName = "bn-IN-Wavenet-A";
      else if (lang === "gu-IN") voiceName = "gu-IN-Standard-A";
      else if (lang === "pa-IN") voiceName = "pa-IN-Standard-A";

      const response = await axios.post(
        `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
        {
          input: { text },
          voice: { languageCode: lang, name: voiceName },
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
  generateFreeTTS(text: string, lang: string): string | null {
    try {
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

  /**
   * Transcribes audio buffer to text (Speech-to-Text).
   */
  async transcribe(
    audioBuffer: Buffer,
    mimeType: string,
    originalName?: string,
  ): Promise<string> {
    const filename = originalName || `audio-${Date.now()}.wav`;
    return transcribeAudio(audioBuffer, filename, mimeType);
  },

  /**
   * Converts a text transcript into a structured JSON intent.
   */
  async extractIntent(transcript: string): Promise<Intent> {
    const systemPrompt = `You are the intent extractor for Gupio, a vehicle management and support services app.
Given a user's spoken command, you must convert it into a structured JSON intent.
You can ONLY output raw JSON. Do not include markdown code block formatting (like \`\`\`json) or any conversational text.

Here are the supported intents and their properties:
1. Navigation / open screen:
   - intent: "open_screen"
   - screenName: string. Map the screen name to exactly one of the following based on the user's intent:
     * "VehicleList" (for garage, vehicles list, my cars)
     * "Challans" (for traffic fines, traffic tickets, challans)
     * "DrivingSummary" (for driving behavior score, driver coach, list of completed trips)
     * "TripExpense" (for trip planner, journey cost estimate, travel budget, toll/route planner)
     * "ServiceHistory" (for maintenance records, service logs)
     * "WarrantyStatus" (for parts details, warranty status)
     * "Expenses" (for spending, cost logs, expense analysis)
     * "SOS" (for emergencies, trigger SOS, safety)
     * "DocumentList" (for documents list, uploaded papers, RC/insurance policy docs)
     * "Valet" (for valet mode, valet settings)
     * "AddVehicle" (for add vehicle, add car, register new vehicle)
     * "MyProfile" (for profile, my account details, user profile)
     * "HelpSupport" (for help, support center, contact support)
     * "Settings" (for app settings, preferences)
     * "BudgetSettings" (for budget settings, set monthly budget limits)
     * "DLVerification" (for driver's license verification, DL check)
     * "Fastag" (for Fastag status, toll tags, Fastag recharge)
     * "DIYGuides" (for DIY repair guides, step-by-step guides)
     * "Odometer" (for odometer, mileage logging, current kms)
     * "Home" (for dashboard, main screen, home)
     * "Services" (for services hub, app services list)
   - CRITICAL: Only map to "open_screen" if the user explicitly wants to navigate to or open a screen/section. Do NOT randomly guess a screen name if there is no clear intent matching the description. If the request is generic or doesn't match any of these screen descriptions, map to "unsupported".

2. Add expense:
   - intent: "add_expense"
   - amount: number (required)
   - category: string. Map to one of: "FUEL", "TOLL", "SERVICE", "PARKING", "INSURANCE", "CHALLAN", "OTHER" (required)
   - merchantName: string (optional)
   - notes: string (optional)

3. Get challans:
   - intent: "get_challans"
   - registrationNumber: string (optional vehicle number plate, e.g. DL1CA1234)

4. Simple actions:
   - intent: "get_expenses_summary" (e.g. "how much did I spend", "show my expenses summary")
   - intent: "get_vehicle_status" (e.g. "is my car okay", "check vehicle status")
   - intent: "get_driving_trips_summary" (e.g. "show my trips")
   - intent: "trigger_sos" (e.g. "call emergency", "trigger SOS", "I am in trouble")

If the command doesn't match any of these features, return:
{
  "intent": "unsupported",
  "message": "I can only help with vehicle management, expenses, challans, and SOS."
}

User command: "${transcript}"
JSON output:`;

    try {
      const rawResponse = await callAI(transcript, systemPrompt);
      const cleanJson = rawResponse.replace(/```json/i, "").replace(/```/g, "").trim();
      const parsed: Intent = JSON.parse(cleanJson);
      return parsed;
    } catch (err) {
      logger.error({ err, transcript }, "Failed to extract intent from transcript");
      return {
        intent: "unsupported",
        message: "Unable to understand the command.",
      };
    }
  },

  /**
   * Processes raw audio, transcribes it, extracts intent, and routes it to backend actions.
   */
  async handleAudio(
    audioBuffer: Buffer,
    mimeType: string,
    originalName?: string,
    customerId?: string,
  ): Promise<any> {
    const transcript = await this.transcribe(audioBuffer, mimeType, originalName);
    if (!transcript) {
      return {
        success: false,
        error: "Could not transcribe audio.",
      };
    }

    const intent = await this.extractIntent(transcript);
    
    // Process intent
    const result = await aiService.processIntent(customerId || "", intent);

    return {
      success: true,
      transcript,
      intent: intent.intent,
      result,
    };
  },
};

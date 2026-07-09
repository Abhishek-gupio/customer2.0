import { createWorker } from "tesseract.js";
import { GoogleGenerativeAI, Part } from "@google/generative-ai";
import { logger } from "../config/logger";
import { env } from "../config/env";
import { AppError } from "../utils/AppError";
import { isGeminiRateLimitError } from "../utils/geminiRateLimit";
import { callAI, isAIConfigured } from "./ai-provider.service";

// Initialize Gemini if API key is present
const genAI = env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(env.GEMINI_API_KEY)
  : null;
const GEMINI_TEXT_MODEL = env.GEMINI_TEXT_MODEL;

export const ocrService = {
  /**
   * Extracts raw text from an image using Tesseract.js
   * Used as a fallback or for simple text indexing.
   */
  async extractText(imageBuffer: Buffer): Promise<string> {
    try {
      // const worker = await createWorker("eng");
      // const { data: { text } } = await worker.recognize(imageBuffer);
      // await worker.terminate();
      // return text;
      return "Tesseract OCR Disabled due to runtime environment issues.";
    } catch (error) {
      logger.error({ err: error }, "OCR text extraction failed");
      throw error;
    }
  },

  /**
   * Uses Generative AI (Gemini) to parse a document image into structured JSON.
   * This is far more accurate than regex for RCs, Insurance, and PUCs.
   */
  async parseDocument(
    imageBuffer: Buffer,
    mimeType: string,
  ): Promise<Record<string, any>> {
    if (!genAI) {
      logger.warn(
        "Gemini API key missing, falling back to basic regex parsing",
      );
      const rawText = await this.extractText(imageBuffer);
      return this.basicRegexParse(rawText);
    }

    try {
      const model = genAI.getGenerativeModel({ model: GEMINI_TEXT_MODEL });

      const prompt = `
                You are an expert Indian vehicle document assistant. 
                Analyze the provided document image (RC, Insurance, PUC, or DL) and extract all relevant information into a clean JSON format.
                
                Expected Fields (if available):
                - type: (RC | INSURANCE | PUC | DL | OTHER)
                - documentNumber: (Registration No, Policy No, or License No)
                - ownerName: (Full name of the owner/insured)
                - vehicleDetails: { make, model, variant, fuelType, chassisNumber, engineNumber, registrationDate, vehicleType }
                - vehicleType hints: (Determine if it's a HATCHBACK | SEDAN | SUV | BIKE | TRUCK | LUV based on model name)
                - dates: [list of all important dates found like expiry, issue, registration]
                - expiryDate: (Specifically identify the expiry date if present)
                - issuerName: (RTO name for RC, Company name for Insurance)
                
                Rules:
                1. Only return valid JSON. No markdown backticks or extra text.
                2. If a field is not found, use null.
                3. For dates, use YYYY-MM-DD format.
            `;

      const imagePart: Part = {
        inlineData: {
          data: imageBuffer.toString("base64"),
          mimeType,
        },
      };

      const result = await model.generateContent([prompt, imagePart]);
      const response = await result.response;
      const text = response.text();

      // Clean up the response in case AI includes markdown JSON blocks
      const jsonStr = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(jsonStr);

      // Add rawText for audit/search purposes
      return {
        ...parsed,
        rawText: "AI Parsed Structured Data",
      };
    } catch (error) {
      logger.error({ err: error }, "Gemini AI parsing failed");
      // Fallback to basic text indexing if AI fails
      let rawText = "";
      try {
        rawText = await this.extractText(imageBuffer);
      } catch (tesseractError) {
        logger.error({ tesseractError }, "Tesseract fallback also failed");
        rawText = "OCR Failed";
      }
      return { rawText, error: "AI parsing failed" };
    }
  },

  /**
   * Parse generic receipts/bills (Fuel, Service, Restaurants, etc.)
   */
  async parseReceipt(
    imageBuffer: Buffer,
    mimeType: string,
  ): Promise<Record<string, any>> {
    if (!genAI) {
      // Fallback to text extraction
      const text = await this.extractText(imageBuffer);
      return { rawText: text, amount: null, error: "AI not configured" };
    }

    try {
      const model = genAI.getGenerativeModel({ model: GEMINI_TEXT_MODEL });
      const prompt = `
First, decide if this image is a RECEIPT, BILL, or INVOICE (a document showing a purchase, transaction, or payment — e.g. fuel slip, service bill, restaurant bill, parking slip, toll slip). 
- If it is NOT a receipt/bill/invoice (e.g. random photo, ID card, screenshot of chat, menu only, advertisement), return exactly: {"isReceipt": false, "error": "Please scan a receipt or bill. This image does not look like a receipt."}
- If it IS a receipt/bill/invoice, set "isReceipt": true and extract the details below.

When isReceipt is true, return a JSON object with:
- isReceipt: true
- amount: (Number - total amount paid. Look for Total, Grand Total, or largest amount. Ignore tax breakdown.)
- merchantName: (Name of the shop, petrol pump, or service center)
- date: (YYYY-MM-DD format)
- category: (One of: FUEL, TOLL, PARKING, SERVICE, INSURANCE, CHALLAN, OTHER)
- vehicleNumber: (Vehicle registration number if visible, e.g., "DL01AB1234")
- notes: (Any relevant details like fuel quantity, items purchased)
- rawText: (Full text visible on the receipt for indexing)

Rules:
1. Return valid JSON only. No markdown.
2. Be precise with the Amount.
3. If the image is not a receipt/bill/invoice, you MUST return isReceipt: false and the error message above.
            `;

      const imagePart: Part = {
        inlineData: {
          data: imageBuffer.toString("base64"),
          mimeType,
        },
      };

      const result = await model.generateContent([prompt, imagePart]);
      const response = await result.response;
      const text = response.text();

      const jsonStr = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(jsonStr);

      if (parsed.isReceipt === false && parsed.error) {
        return { error: parsed.error, rawText: "", isReceipt: false };
      }

      return parsed;
    } catch (error) {
      logger.error({ err: error }, "Gemini Receipt parsing failed");
      // Fallback to text extraction
      const text = await this.extractText(imageBuffer);
      return { rawText: text, error: "AI parsing failed" };
    }
  },

  /**
   * Simple regex-based fallback for when AI is unavailable
   */
  async basicRegexParse(text: string): Promise<Record<string, any>> {
    const results: Record<string, any> = { rawText: text };

    // Basic date extraction
    const dateRegex = /(\d{2})[-/](\d{2})[-/](\d{4})/g;
    const dates = text.match(dateRegex);
    if (dates) results.dates = dates;

    // Basic RC number discovery
    const docNoRegex = /[A-Z]{2}\d{2}\s?[A-Z]{1,2}\s?\d{4}/i;
    const docMatch = text.match(docNoRegex);
    if (docMatch) results.documentNumber = docMatch[0];

    return results;
  },
  async parseOdometer(
    imageBuffer: Buffer,
    mimeType: string,
  ): Promise<number | null> {
    if (!genAI) return null;

    try {
      const model = genAI.getGenerativeModel({ model: GEMINI_TEXT_MODEL });
      const prompt = `
                Analyze this car dashboard image and extract ONLY the current odometer reading (total distance traveled).
                Return ONLY the number. No units (km/miles), no text.
                If there are multiple numbers, look for the one labeled 'ODO', 'Odometer', or the largest static number on the cluster.
                If no odometer is found, return null.
            `;

      const imagePart: Part = {
        inlineData: {
          data: imageBuffer.toString("base64"),
          mimeType,
        },
      };

      const result = await model.generateContent([prompt, imagePart]);
      const text = (await result.response).text().trim();

      const reading = parseInt(text.replace(/[^0-9]/g, ""));
      return isNaN(reading) ? null : reading;
    } catch (error) {
      logger.error({ err: error }, "AI Odometer parsing failed");
      return null;
    }
  },

  /**
   * Uses Gemini to transcribe voice audio AND extract expense details in one shot.
   * Supports: audio/webm, audio/mp3, audio/wav, audio/m4a, audio/ogg
   */
  async parseVoiceExpense(
    audioBuffer: Buffer,
    mimeType: string,
  ): Promise<Record<string, any>> {
    if (!genAI) {
      logger.warn("Gemini API key missing, cannot parse voice expense");
      return { error: "AI not configured", rawText: "" };
    }

    try {
      const voiceModel = env.GEMINI_VOICE_MODEL || GEMINI_TEXT_MODEL;
      const model = genAI.getGenerativeModel({
        model: voiceModel,
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 1024,
          topP: 0.95,
          topK: 40,
        },
      });
      const today = new Date().toISOString().split("T")[0];
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];

      const prompt = `
Listen to this audio. The user is describing a vehicle expense in any language (Hindi, Tamil, English, etc.).
1. Transcribe what they said.
2. Extract: amount (number, INR), category (FUEL, TOLL, PARKING, SERVICE, INSURANCE, CHALLAN, EMI, OTHER), merchantName if any, date (YYYY-MM-DD: use "${today}" for today/aaj/unspecified, "${yesterdayStr}" for yesterday/kal).
Return ONLY a JSON object with: transcription, amount, category, merchantName, date, parts (or null), notes (or null), confidence (HIGH/MEDIUM/LOW). No markdown. Amount is required; if unclear use 0 and LOW confidence.
            `;

      const audioPart: Part = {
        inlineData: {
          data: audioBuffer.toString("base64"),
          mimeType,
        },
      };

      const result = await model.generateContent([prompt, audioPart]);
      const response = await result.response;
      const text = response.text();
      const parsed = this.parseJsonFromVoiceResponse(text, "");
      return parsed;
    } catch (error) {
      if (isGeminiRateLimitError(error)) {
        throw AppError.tooManyRequests(
          "AI is busy. Please try again in a moment.",
          "GEMINI_RATE_LIMIT"
        );
      }
      logger.error({ err: error }, "Gemini Voice Expense parsing failed");
      return { error: "Voice parsing failed", rawText: "" };
    }
  },

  /**
   * Same as parseVoiceExpense but for already-transcribed text (e.g. from device speech-to-text).
   * Uses Gemini to extract expense details from the transcription. Uses few-shot examples and
   * structured rules for higher accuracy; model is configurable via GEMINI_VOICE_MODEL.
   */
  async parseVoiceExpenseFromText(transcription: string): Promise<Record<string, any>> {
    if (!isAIConfigured()) {
      logger.warn("No AI provider configured, cannot parse voice text");
      return { error: "AI not configured", rawText: transcription };
    }
    if (!transcription?.trim()) {
      return { error: "No text provided", rawText: "" };
    }

    try {
      const now = new Date();
      const today = now.toISOString().split("T")[0];
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];
      const currentYear = now.getFullYear();

      const prompt = `You are an expert Indian vehicle expense extractor. The user spoke in their language (Hindi, Tamil, Telugu, Kannada, Malayalam, Bengali, English, Hinglish, etc.). Transcribed text is below. Extract ONLY the requested fields. Return nothing but a single JSON object.

REFERENCE DATES (use exactly these strings):
- TODAY = "${today}" (use for: aaj, today, இன்று, ఈరోజు, आज, or when no date given)
- YESTERDAY = "${yesterdayStr}" (use for: kal, yesterday, நேற்று, నిన్న, कल)
- Year must be ${currentYear} unless user says another year explicitly.

CATEGORIES (exactly one): FUEL, TOLL, PARKING, SERVICE, INSURANCE, CHALLAN, EMI, OTHER.
- FUEL: petrol, diesel, gas, எரிபொருள், పెట్రోల్, पेट्रोल
- TOLL: toll, FASTag, டோல், टोल
- PARKING: parking, பார்க்கிங்
- SERVICE: service, repair, garage, சர்வீஸ்
- CHALLAN: challan, fine, traffic, ஜன்மதி
- INSURANCE: insurance, policy
- EMI: EMI, loan
- OTHER: anything else

EXAMPLES (follow this format exactly):

Input: "500 rupees fuel today"
Output: {"transcription":"500 rupees fuel today","amount":500,"category":"FUEL","merchantName":null,"date":"${today}","parts":null,"notes":null,"confidence":"HIGH"}

Input: "aaj kal 200 toll"
Output: {"transcription":"aaj kal 200 toll","amount":200,"category":"TOLL","merchantName":null,"date":"${today}","parts":null,"notes":null,"confidence":"MEDIUM"}

Input: "நேற்று ஐநூறு எரிபொருள்"
Output: {"transcription":"நேற்று ஐநூறு எரிபொருள்","amount":500,"category":"FUEL","merchantName":null,"date":"${yesterdayStr}","parts":null,"notes":null,"confidence":"HIGH"}

Input: "I spent two thousand on parking yesterday"
Output: {"transcription":"I spent two thousand on parking yesterday","amount":2000,"category":"PARKING","merchantName":null,"date":"${yesterdayStr}","parts":null,"notes":null,"confidence":"HIGH"}

Input: "service 3500 at ram garage"
Output: {"transcription":"service 3500 at ram garage","amount":3500,"category":"SERVICE","merchantName":"ram garage","date":"${today}","parts":null,"notes":null,"confidence":"HIGH"}

RULES:
1. amount: MUST be a number. Parse digits (500, 1,200) or words (paanch sau, two thousand, ஐநூறு) to a single number. If unclear, use 0 and confidence LOW.
2. category: MUST be one of the 8 categories above. Map any language to that exact word.
3. date: MUST be exactly "${today}" or "${yesterdayStr}" (year ${currentYear}).
4. Only return the JSON object. No markdown, no backticks, no explanation.

User said: "${transcription}"

JSON:`;

      const text = await callAI(prompt, undefined, { temperature: 0.1, maxOutputTokens: 1024 });
      const parsed = this.parseJsonFromVoiceResponse(text, transcription);
      return parsed;
    } catch (error) {
      if (isGeminiRateLimitError(error)) {
        throw AppError.tooManyRequests(
          "AI is busy. Please try again in a moment.",
          "GEMINI_RATE_LIMIT"
        );
      }
      logger.error({ err: error }, "Voice text parsing failed");
      return { error: "Voice text parsing failed", rawText: transcription };
    }
  },

  /** Extract and parse JSON from model output; tolerates markdown and extra text. */
  parseJsonFromVoiceResponse(rawText: string, fallbackTranscription: string): Record<string, any> {
    let jsonStr = rawText.replace(/```json\s*|```\s*/gi, "").trim();
    const firstBrace = jsonStr.indexOf("{");
    if (firstBrace !== -1) {
      const lastBrace = jsonStr.lastIndexOf("}");
      if (lastBrace > firstBrace) {
        jsonStr = jsonStr.slice(firstBrace, lastBrace + 1);
      }
    }
    try {
      const parsed = JSON.parse(jsonStr);
      parsed.transcription = parsed.transcription ?? fallbackTranscription;
      if (typeof parsed.amount === "string") parsed.amount = Number(parsed.amount) || 0;
      return parsed;
    } catch {
      try {
        const repaired = jsonStr.replace(/(\w+):/g, '"$1":').replace(/'/g, '"');
        const parsed = JSON.parse(repaired);
        parsed.transcription = parsed.transcription ?? fallbackTranscription;
        return parsed;
      } catch {
        return { error: "Could not parse AI response", rawText: rawText.slice(0, 200) };
      }
    }
  },

  /**
   * AI-POWERED EXPENSE TEXT PARSER (Primary Parser)
   * ================================================
   * Uses Gemini to understand notification/SMS text and extract expense data.
   * Far more accurate than regex — understands context, Hindi, bank formats.
   *
   * Examples it handles that regex CANNOT:
   * - "SBI Ac X1234 debited ₹2,147.50 on 09Feb via UPI to HARIOM FUEL STATION@ybl"
   *   → Regex: category OTHER | AI: category FUEL ✅
   * - "Aapke HDFC ac se 85.00 toll charge kata gaya at DND Flyway"
   *   → Regex: might miss | AI: category TOLL, merchant "DND Flyway" ✅
   */
  async parseExpenseNotification(text: string): Promise<{
    amount: number;
    category: string;
    merchantName: string | null;
    date: string | null;
    confidence: "HIGH" | "MEDIUM" | "LOW";
    notes: string | null;
    error?: string;
  }> {
    if (!isAIConfigured()) {
      return {
        amount: 0,
        category: "OTHER",
        merchantName: null,
        date: null,
        confidence: "LOW",
        notes: null,
        error: "AI not configured",
      };
    }

    try {
      const prompt = `
                You are an expert Indian financial transaction parser.
                Parse this notification/SMS text and extract expense details.

                TEXT: "${text}"

                Return a JSON object with these fields:
                - amount: (Number - the expense amount. Parse Indian formats: "2,147.50" → 2147.50, "Rs.500" → 500)
                - category: (One of: FUEL, TOLL, PARKING, SERVICE, INSURANCE, CHALLAN, EMI, OTHER)
                  Smart rules:
                  - Any petrol pump, fuel station, HP, IOCL, BPCL, Shell → FUEL
                  - FASTag, toll plaza, NHAI, highway charges → TOLL
                  - Service center, garage, mechanic, tyre shop → SERVICE
                  - Parking charges, valet → PARKING
                  - Traffic fine, e-challan → CHALLAN
                  - Insurance premium, policy renewal → INSURANCE
                  - Loan EMI, car loan → EMI
                  - If unclear, use OTHER
                - merchantName: (Name of shop/merchant. Extract from "paid to X", "at X", UPI ID like "SHELL@ybl" → "Shell")
                - date: (Date in YYYY-MM-DD format. Parse from text if available. Today is ${new Date().toISOString().split("T")[0]})
                - confidence: (HIGH if amount+category are clear, MEDIUM if partially clear, LOW if guessing)
                - notes: (Any extra detail: account number, UPI ref, transaction type)

                Rules:
                1. Only return valid JSON. No markdown backticks or extra text.
                2. amount is REQUIRED. If you cannot determine amount, set it to 0.
                3. Look for debit/paid/sent keywords — ignore credit/received/refund transactions.
                4. If this is a credit/refund (money received), set amount to 0 and note "CREDIT_TXN" in notes.
            `;

      const responseText = await callAI(prompt);

      const jsonStr = responseText.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(jsonStr);

      // Validate category
      const validCategories = [
        "FUEL",
        "TOLL",
        "PARKING",
        "SERVICE",
        "INSURANCE",
        "CHALLAN",
        "EMI",
        "OTHER",
      ];
      if (!validCategories.includes(parsed.category)) {
        parsed.category = "OTHER";
      }

      return parsed;
    } catch (error) {
      logger.error({ err: error }, "AI notification parsing failed");
      return {
        amount: 0,
        category: "OTHER",
        merchantName: null,
        date: null,
        confidence: "LOW",
        notes: null,
        error: "AI parsing failed",
      };
    }
  },

  /**
   * AI SERVICE DETAIL EXTRACTOR
   * ============================
   * When a SERVICE expense is detected, this extracts WHAT was serviced.
   * Uses AI to predict parts based on: amount, merchant name, and any context.
   *
   * Example: "₹4,500 at Maruti Service Center"
   * AI predicts: Regular Service → Engine Oil + Oil Filter + Air Filter
   */
  async parseServiceDetails(
    text: string,
    amount: number,
    merchantName: string | null,
  ): Promise<{
    serviceType: string;
    predictedParts: {
      partType: string;
      partName: string;
      estimatedCost: number;
      warrantyMonths: number;
    }[];
    nextServiceKm: number;
    confidence: "HIGH" | "MEDIUM" | "LOW";
    notes: string | null;
  }> {
    if (!isAIConfigured()) {
      // Fallback: basic prediction based on amount
      return this.basicServicePrediction(amount, merchantName);
    }

    try {
      const prompt = `
                You are an expert Indian vehicle service advisor.
                A customer just paid for a vehicle service. Based on the information below, predict what was serviced.

                PAYMENT TEXT: "${text}"
                AMOUNT: ₹${amount}
                MERCHANT: ${merchantName || "Unknown garage"}

                Return a JSON object with:
                - serviceType: One of "REGULAR_SERVICE", "REPAIR", "ACCIDENT", "MODIFICATION"
                - predictedParts: Array of parts that were likely serviced. Each part has:
                    - partType: One of "ENGINE_OIL", "OIL_FILTER", "AIR_FILTER", "BRAKE_PADS", "BRAKE_DISCS", "BATTERY", "TYRES", "CLUTCH_PLATES", "SPARK_PLUGS", "COOLANT", "TIMING_BELT", "AC_FILTER", "WIPER_BLADES", "HEADLIGHT_BULB", "OTHER"
                    - partName: Human readable name (e.g., "Engine Oil 5W-30")
                    - estimatedCost: Estimated cost of this part in INR
                    - warrantyMonths: Typical warranty for this part (3-24 months)
                - nextServiceKm: How many kilometers until next service (typically 10000 for regular, 5000 for oil change only)
                - confidence: "HIGH" if amount and context clearly indicate specific service, "MEDIUM" if somewhat clear, "LOW" if guessing
                - notes: Any additional observations

                Prediction guidelines based on amount:
                - ₹500-1500: Oil change only (Engine Oil + Oil Filter)
                - ₹1500-3000: Minor service (Oil + Oil Filter + Air Filter + inspection)
                - ₹3000-6000: Regular service (Oil + Filters + Brake check + Coolant top-up)
                - ₹6000-15000: Major service (All filters + Brake pads + Spark plugs + multiple items)
                - ₹15000+: Major repair or multiple part replacement

                If merchant name contains brand names (Maruti, Honda, Hyundai, Toyota), it's likely an authorized service center — higher part quality and warranty.

                Rules:
                1. Return ONLY valid JSON. No markdown.
                2. Sum of all estimatedCost should be close to the total amount.
                3. Be realistic with Indian market pricing.
            `;

      const responseText = await callAI(prompt);

      const jsonStr = responseText.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(jsonStr);

      // Validate partTypes
      const validParts = [
        "ENGINE_OIL",
        "OIL_FILTER",
        "AIR_FILTER",
        "BRAKE_PADS",
        "BRAKE_DISCS",
        "BATTERY",
        "TYRES",
        "CLUTCH_PLATES",
        "SPARK_PLUGS",
        "COOLANT",
        "TIMING_BELT",
        "AC_FILTER",
        "WIPER_BLADES",
        "HEADLIGHT_BULB",
        "OTHER",
      ];
      if (parsed.predictedParts) {
        parsed.predictedParts = parsed.predictedParts.filter((p: any) =>
          validParts.includes(p.partType),
        );
      }

      return parsed;
    } catch (error) {
      logger.error({ err: error }, "AI service detail extraction failed");
      return this.basicServicePrediction(amount, merchantName);
    }
  },

  /**
   * BASIC SERVICE PREDICTION (No-AI fallback)
   * Uses amount-based heuristics when Gemini is unavailable.
   */
  basicServicePrediction(amount: number, merchantName: string | null) {
    let serviceType = "REGULAR_SERVICE";
    const predictedParts: any[] = [];

    if (amount <= 1500) {
      // Oil change only
      predictedParts.push(
        {
          partType: "ENGINE_OIL",
          partName: "Engine Oil",
          estimatedCost: Math.round(amount * 0.7),
          warrantyMonths: 6,
        },
        {
          partType: "OIL_FILTER",
          partName: "Oil Filter",
          estimatedCost: Math.round(amount * 0.3),
          warrantyMonths: 6,
        },
      );
    } else if (amount <= 4000) {
      // Minor service
      predictedParts.push(
        {
          partType: "ENGINE_OIL",
          partName: "Engine Oil",
          estimatedCost: Math.round(amount * 0.4),
          warrantyMonths: 6,
        },
        {
          partType: "OIL_FILTER",
          partName: "Oil Filter",
          estimatedCost: Math.round(amount * 0.15),
          warrantyMonths: 6,
        },
        {
          partType: "AIR_FILTER",
          partName: "Air Filter",
          estimatedCost: Math.round(amount * 0.2),
          warrantyMonths: 12,
        },
      );
    } else if (amount <= 10000) {
      // Regular service
      predictedParts.push(
        {
          partType: "ENGINE_OIL",
          partName: "Engine Oil",
          estimatedCost: Math.round(amount * 0.25),
          warrantyMonths: 6,
        },
        {
          partType: "OIL_FILTER",
          partName: "Oil Filter",
          estimatedCost: Math.round(amount * 0.1),
          warrantyMonths: 6,
        },
        {
          partType: "AIR_FILTER",
          partName: "Air Filter",
          estimatedCost: Math.round(amount * 0.1),
          warrantyMonths: 12,
        },
        {
          partType: "BRAKE_PADS",
          partName: "Brake Pads (Front)",
          estimatedCost: Math.round(amount * 0.25),
          warrantyMonths: 12,
        },
        {
          partType: "COOLANT",
          partName: "Coolant Top-up",
          estimatedCost: Math.round(amount * 0.1),
          warrantyMonths: 12,
        },
      );
    } else {
      // Major service
      serviceType = "REPAIR";
      predictedParts.push(
        {
          partType: "ENGINE_OIL",
          partName: "Engine Oil",
          estimatedCost: Math.round(amount * 0.15),
          warrantyMonths: 6,
        },
        {
          partType: "OIL_FILTER",
          partName: "Oil Filter",
          estimatedCost: Math.round(amount * 0.05),
          warrantyMonths: 6,
        },
        {
          partType: "AIR_FILTER",
          partName: "Air Filter",
          estimatedCost: Math.round(amount * 0.08),
          warrantyMonths: 12,
        },
        {
          partType: "BRAKE_PADS",
          partName: "Brake Pads",
          estimatedCost: Math.round(amount * 0.2),
          warrantyMonths: 12,
        },
        {
          partType: "SPARK_PLUGS",
          partName: "Spark Plugs",
          estimatedCost: Math.round(amount * 0.12),
          warrantyMonths: 24,
        },
        {
          partType: "COOLANT",
          partName: "Coolant",
          estimatedCost: Math.round(amount * 0.1),
          warrantyMonths: 12,
        },
        {
          partType: "AC_FILTER",
          partName: "AC Filter",
          estimatedCost: Math.round(amount * 0.08),
          warrantyMonths: 12,
        },
      );
    }

    const isAuthorizedCenter = merchantName
      ? /maruti|honda|hyundai|toyota|tata|mahindra|kia|suzuki|volkswagen|skoda/i.test(
          merchantName,
        )
      : false;

    return {
      serviceType,
      predictedParts,
      nextServiceKm: 10000,
      confidence: "LOW" as const,
      notes: isAuthorizedCenter
        ? `Likely authorized service center (${merchantName}). Parts may have OEM warranty.`
        : "AI unavailable — predictions based on amount heuristics. Please review and correct.",
    };
  },
};

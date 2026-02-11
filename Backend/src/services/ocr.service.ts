import { createWorker } from "tesseract.js";
import { GoogleGenerativeAI, Part } from "@google/generative-ai";
import { logger } from "../config/logger";
import { env } from "../config/env";

// Initialize Gemini if API key is present
const genAI = env.GEMINI_API_KEY ? new GoogleGenerativeAI(env.GEMINI_API_KEY) : null;

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
            logger.error({ error }, "OCR text extraction failed");
            throw error;
        }
    },

    /**
     * Uses Generative AI (Gemini) to parse a document image into structured JSON.
     * This is far more accurate than regex for RCs, Insurance, and PUCs.
     */
    async parseDocument(imageBuffer: Buffer, mimeType: string): Promise<Record<string, any>> {
        if (!genAI) {
            logger.warn("Gemini API key missing, falling back to basic regex parsing");
            const rawText = await this.extractText(imageBuffer);
            return this.basicRegexParse(rawText);
        }

        try {
            const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

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
                    mimeType
                }
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
                rawText: "AI Parsed Structured Data"
            };

        } catch (error) {
            logger.error({ error }, "Gemini AI parsing failed");
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
    async parseOdometer(imageBuffer: Buffer, mimeType: string): Promise<number | null> {
        if (!genAI) return null;

        try {
            const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
            const prompt = `
                Analyze this car dashboard image and extract ONLY the current odometer reading (total distance traveled).
                Return ONLY the number. No units (km/miles), no text.
                If there are multiple numbers, look for the one labeled 'ODO', 'Odometer', or the largest static number on the cluster.
                If no odometer is found, return null.
            `;

            const imagePart: Part = {
                inlineData: {
                    data: imageBuffer.toString("base64"),
                    mimeType
                }
            };

            const result = await model.generateContent([prompt, imagePart]);
            const text = (await result.response).text().trim();

            const reading = parseInt(text.replace(/[^0-9]/g, ""));
            return isNaN(reading) ? null : reading;

        } catch (error) {
            logger.error({ error }, "AI Odometer parsing failed");
            return null;
        }
    },

    /**
     * Uses Gemini to transcribe voice audio AND extract expense details in one shot.
     * Supports: audio/webm, audio/mp3, audio/wav, audio/m4a, audio/ogg
     */
    async parseVoiceExpense(audioBuffer: Buffer, mimeType: string): Promise<Record<string, any>> {
        if (!genAI) {
            logger.warn("Gemini API key missing, cannot parse voice expense");
            return { error: "AI not configured", rawText: "" };
        }

        try {
            const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

            const prompt = `
                You are an intelligent Indian vehicle expense assistant.
                Listen to this audio recording. The user is describing a vehicle-related expense they made.
                
                Your job:
                1. Transcribe what the user said.
                2. Extract expense details from the transcription.
                
                Return a JSON object with these fields:
                - transcription: (The full text of what the user said)
                - amount: (Number - the expense amount in INR. If user says "paanch sau" return 500, "do hazaar" return 2000, etc.)
                - category: (One of: FUEL, TOLL, PARKING, SERVICE, INSURANCE, CHALLAN, EMI, OTHER)
                - merchantName: (Name of the shop/pump/garage if mentioned, else null)
                - date: (Date in YYYY-MM-DD format. If user says "kal" or "yesterday", calculate from today ${new Date().toISOString().split('T')[0]}. If "aaj" or "today", use today. If not mentioned, use today.)
                - parts: (Optional. If category is SERVICE/REPAIR and user mentions specific items, return an array of { partName, amount }. E.g., "changed oil for 1200 and filter for 400" -> [{ "partName": "Engine Oil", "amount": 1200 }, { "partName": "Oil Filter", "amount": 400 }])
                - notes: (Any extra detail the user mentioned, like "full tank", "front tyre", etc.)
                - confidence: (HIGH, MEDIUM, or LOW based on how clear the audio was)
                
                Rules:
                1. Only return valid JSON. No markdown backticks or extra text.
                2. Handle Hindi, Hinglish, and English inputs.
                3. If a field cannot be determined, use null.
                4. Amount is REQUIRED. If you cannot determine the amount, set confidence to LOW.
                5. If parts are mentioned, their amounts should sum up close to the total amount.
            `;

            const audioPart: Part = {
                inlineData: {
                    data: audioBuffer.toString("base64"),
                    mimeType
                }
            };

            const result = await model.generateContent([prompt, audioPart]);
            const response = await result.response;
            const text = response.text();

            const jsonStr = text.replace(/```json|```/g, "").trim();
            const parsed = JSON.parse(jsonStr);

            return parsed;

        } catch (error) {
            logger.error({ error }, "Gemini Voice Expense parsing failed");
            return { error: "Voice parsing failed", rawText: "" };
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
        if (!genAI) {
            return { amount: 0, category: "OTHER", merchantName: null, date: null, confidence: "LOW", notes: null, error: "AI not configured" };
        }

        try {
            const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

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
                - date: (Date in YYYY-MM-DD format. Parse from text if available. Today is ${new Date().toISOString().split('T')[0]})
                - confidence: (HIGH if amount+category are clear, MEDIUM if partially clear, LOW if guessing)
                - notes: (Any extra detail: account number, UPI ref, transaction type)

                Rules:
                1. Only return valid JSON. No markdown backticks or extra text.
                2. amount is REQUIRED. If you cannot determine amount, set it to 0.
                3. Look for debit/paid/sent keywords — ignore credit/received/refund transactions.
                4. If this is a credit/refund (money received), set amount to 0 and note "CREDIT_TXN" in notes.
            `;

            const result = await model.generateContent(prompt);
            const response = await result.response;
            const responseText = response.text();

            const jsonStr = responseText.replace(/```json|```/g, "").trim();
            const parsed = JSON.parse(jsonStr);

            // Validate category
            const validCategories = ["FUEL", "TOLL", "PARKING", "SERVICE", "INSURANCE", "CHALLAN", "EMI", "OTHER"];
            if (!validCategories.includes(parsed.category)) {
                parsed.category = "OTHER";
            }

            return parsed;

        } catch (error) {
            logger.error({ error }, "Gemini notification parsing failed");
            return { amount: 0, category: "OTHER", merchantName: null, date: null, confidence: "LOW", notes: null, error: "AI parsing failed" };
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
    async parseServiceDetails(text: string, amount: number, merchantName: string | null): Promise<{
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
        if (!genAI) {
            // Fallback: basic prediction based on amount
            return this.basicServicePrediction(amount, merchantName);
        }

        try {
            const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

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

            const result = await model.generateContent(prompt);
            const response = await result.response;
            const responseText = response.text();

            const jsonStr = responseText.replace(/```json|```/g, "").trim();
            const parsed = JSON.parse(jsonStr);

            // Validate partTypes
            const validParts = ["ENGINE_OIL", "OIL_FILTER", "AIR_FILTER", "BRAKE_PADS", "BRAKE_DISCS", "BATTERY", "TYRES", "CLUTCH_PLATES", "SPARK_PLUGS", "COOLANT", "TIMING_BELT", "AC_FILTER", "WIPER_BLADES", "HEADLIGHT_BULB", "OTHER"];
            if (parsed.predictedParts) {
                parsed.predictedParts = parsed.predictedParts.filter((p: any) =>
                    validParts.includes(p.partType)
                );
            }

            return parsed;

        } catch (error) {
            logger.error({ error }, "AI service detail extraction failed");
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
                { partType: "ENGINE_OIL", partName: "Engine Oil", estimatedCost: Math.round(amount * 0.7), warrantyMonths: 6 },
                { partType: "OIL_FILTER", partName: "Oil Filter", estimatedCost: Math.round(amount * 0.3), warrantyMonths: 6 }
            );
        } else if (amount <= 4000) {
            // Minor service
            predictedParts.push(
                { partType: "ENGINE_OIL", partName: "Engine Oil", estimatedCost: Math.round(amount * 0.4), warrantyMonths: 6 },
                { partType: "OIL_FILTER", partName: "Oil Filter", estimatedCost: Math.round(amount * 0.15), warrantyMonths: 6 },
                { partType: "AIR_FILTER", partName: "Air Filter", estimatedCost: Math.round(amount * 0.2), warrantyMonths: 12 }
            );
        } else if (amount <= 10000) {
            // Regular service
            predictedParts.push(
                { partType: "ENGINE_OIL", partName: "Engine Oil", estimatedCost: Math.round(amount * 0.25), warrantyMonths: 6 },
                { partType: "OIL_FILTER", partName: "Oil Filter", estimatedCost: Math.round(amount * 0.1), warrantyMonths: 6 },
                { partType: "AIR_FILTER", partName: "Air Filter", estimatedCost: Math.round(amount * 0.1), warrantyMonths: 12 },
                { partType: "BRAKE_PADS", partName: "Brake Pads (Front)", estimatedCost: Math.round(amount * 0.25), warrantyMonths: 12 },
                { partType: "COOLANT", partName: "Coolant Top-up", estimatedCost: Math.round(amount * 0.1), warrantyMonths: 12 }
            );
        } else {
            // Major service
            serviceType = "REPAIR";
            predictedParts.push(
                { partType: "ENGINE_OIL", partName: "Engine Oil", estimatedCost: Math.round(amount * 0.15), warrantyMonths: 6 },
                { partType: "OIL_FILTER", partName: "Oil Filter", estimatedCost: Math.round(amount * 0.05), warrantyMonths: 6 },
                { partType: "AIR_FILTER", partName: "Air Filter", estimatedCost: Math.round(amount * 0.08), warrantyMonths: 12 },
                { partType: "BRAKE_PADS", partName: "Brake Pads", estimatedCost: Math.round(amount * 0.2), warrantyMonths: 12 },
                { partType: "SPARK_PLUGS", partName: "Spark Plugs", estimatedCost: Math.round(amount * 0.12), warrantyMonths: 24 },
                { partType: "COOLANT", partName: "Coolant", estimatedCost: Math.round(amount * 0.1), warrantyMonths: 12 },
                { partType: "AC_FILTER", partName: "AC Filter", estimatedCost: Math.round(amount * 0.08), warrantyMonths: 12 }
            );
        }

        const isAuthorizedCenter = merchantName
            ? /maruti|honda|hyundai|toyota|tata|mahindra|kia|suzuki|volkswagen|skoda/i.test(merchantName)
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

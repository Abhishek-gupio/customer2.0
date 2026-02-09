import { createWorker } from "tesseract.js";
import { logger } from "../config/logger";

export const ocrService = {
    async extractText(imagePath: string | Buffer): Promise<string> {
        try {
            const worker = await createWorker("eng");
            const { data: { text } } = await worker.recognize(imagePath);
            await worker.terminate();
            return text;
        } catch (error) {
            logger.error({ error }, "OCR text extraction failed");
            throw error;
        }
    },

    async parseDocument(text: string): Promise<Record<string, any>> {
        // Basic regex-based parsing for demo/starter
        // In production, this would be more sophisticated or use LLM
        const results: Record<string, any> = {};

        // Example: Find dates
        const dateRegex = /(\d{2})[-/](\d{2})[-/](\d{4})/g;
        const dates = text.match(dateRegex);
        if (dates) results.dates = dates;

        // Example: Find document numbers (placeholder logic)
        const docNoRegex = /[A-Z]{2}\d{2}\s?[A-Z]{1,2}\s?\d{4}/i; // Simplified RC format
        const docMatch = text.match(docNoRegex);
        if (docMatch) results.documentNumber = docMatch[0];

        return results;
    },
};

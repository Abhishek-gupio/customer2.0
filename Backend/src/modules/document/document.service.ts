import { dbInstances } from "@repo/db-customer";
import { storageService } from "../../services/storage.service";
import { ocrService } from "../../services/ocr.service";
import { AppError } from "../../utils/AppError";
import { UploadDocumentInput } from "./document.validators";
import { logger } from "../../config/logger";

export const documentService = {
    async uploadDocument(
        customerId: string,
        file: Express.Multer.File,
        input: UploadDocumentInput
    ) {
        // 1. Upload to S3
        const { url, key } = await storageService.uploadFile(file, `documents/${customerId}`);

        // 2. Check for duplicates in input
        if (input.documentNumber) {
            const existing = await dbInstances.customerDocument.findFirst({
                where: {
                    customerId,
                    documentNumber: input.documentNumber,
                    type: input.type
                },
            });
            if (existing) {
                throw AppError.conflict("Document with this number already exists for this customer");
            }
        }

        // 3. Optional: Run OCR
        let ocrData = null;
        let extractedFields = null;
        try {
            const text = await ocrService.extractText(file.buffer);
            ocrData = { raw: text };
            extractedFields = await ocrService.parseDocument(text);
        } catch (err) {
            logger.warn({ err }, "OCR failed during document upload, skipping...");
        }

        // 4. Save to DB
        const document = await dbInstances.customerDocument.create({
            data: {
                customerId,
                vehicleId: input.vehicleId,
                type: input.type,
                documentNumber: input.documentNumber || (extractedFields?.documentNumber as string),
                issueDate: input.issueDate ? new Date(input.issueDate) : undefined,
                expiryDate: input.expiryDate ? new Date(input.expiryDate) : (extractedFields?.dates?.[0] ? new Date(extractedFields.dates[0]) : undefined),
                issuerName: input.issuerName,
                fileUrl: url,
                fileSize: file.size,
                mimeType: file.mimetype,
                ocrData: ocrData as any,
                extractedFields: extractedFields as any,
                source: "UPLOAD",
            },
        });

        return document;
    },

    async listDocuments(customerId: string) {
        return dbInstances.customerDocument.findMany({
            where: { customerId },
            orderBy: { createdAt: "desc" },
        });
    },

    async getDocument(customerId: string, documentId: string) {
        const document = await dbInstances.customerDocument.findUnique({
            where: { id: documentId },
        });

        if (!document || document.customerId !== customerId) {
            throw AppError.notFound("Document not found");
        }

        return document;
    },

    async deleteDocument(customerId: string, documentId: string) {
        const document = await this.getDocument(customerId, documentId);

        await dbInstances.customerDocument.delete({
            where: { id: documentId },
        });

        // Optional: Delete from S3 (implement in storage service if needed)

        return { success: true };
    },
    async getExpiringDocuments(customerId: string, days = 30) {
        const threshold = new Date();
        threshold.setDate(threshold.getDate() + days);

        return dbInstances.customerDocument.findMany({
            where: {
                customerId,
                expiryDate: {
                    not: null,
                    lte: threshold,
                    gte: new Date(),
                },
            },
            orderBy: { expiryDate: "asc" },
        });
    },
};


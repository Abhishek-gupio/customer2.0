import { z } from "zod";
import { DocumentType, DocumentSource } from "../../const/document";

export const uploadDocumentSchema = z.object({
    type: z.nativeEnum(DocumentType),
    vehicleId: z.string().optional(),
    documentNumber: z.string().optional(),
    issueDate: z.string().datetime().optional(),
    expiryDate: z.string().datetime().optional(),
    issuerName: z.string().optional(),
});

export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>;

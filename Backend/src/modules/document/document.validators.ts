import { z } from "zod";
import { DocumentType, DocumentSource } from "../../const/document";

export const uploadDocumentSchema = z.object({
  type: z.nativeEnum(DocumentType),
  vehicleId: z.string().optional(),
  documentNumber: z.string().optional(),
  expiryDate: z.string().datetime().optional(),
});

export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>;

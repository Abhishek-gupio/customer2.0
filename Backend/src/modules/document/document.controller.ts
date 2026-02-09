import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { success } from "../../utils/apiResponse";
import { documentService } from "./document.service";
import { uploadDocumentSchema } from "./document.validators";
import { AppError } from "../../utils/AppError";

function parseBody<T>(
    req: Request,
    schema: { safeParse: (v: unknown) => { success: boolean; data?: T; error?: { issues: { message: string }[] } } }
): T {
    const result = schema.safeParse(req.body);
    if (!result.success && result.error) {
        const first = result.error.issues[0]?.message ?? "Validation failed";
        throw AppError.badRequest(first);
    }
    return result.data!;
}

export const documentController = {
    upload: asyncHandler(async (req: Request, res: Response) => {
        if (!req.file) {
            throw AppError.badRequest("No file uploaded");
        }

        if (!req.customer?.id) {
            throw AppError.unauthorized();
        }

        const body = parseBody(req, uploadDocumentSchema);
        const document = await documentService.uploadDocument(req.customer.id, req.file, body);

        success(res, document, 201);
    }),

    list: asyncHandler(async (req: Request, res: Response) => {
        if (!req.customer?.id) throw AppError.unauthorized();
        const documents = await documentService.listDocuments(req.customer.id);
        success(res, documents);
    }),

    getById: asyncHandler(async (req: Request, res: Response) => {
        if (!req.customer?.id) throw AppError.unauthorized();
        const document = await documentService.getDocument(req.customer.id, req.params.id as string);
        success(res, document);
    }),

    delete: asyncHandler(async (req: Request, res: Response) => {
        if (!req.customer?.id) throw AppError.unauthorized();
        const result = await documentService.deleteDocument(req.customer.id, req.params.id as string);
        success(res, result);
    }),

    getExpiring: asyncHandler(async (req: Request, res: Response) => {
        if (!req.customer?.id) throw AppError.unauthorized();
        const days = req.query.days ? parseInt(req.query.days as string) : 30;
        const result = await documentService.getExpiringDocuments(req.customer.id, days);
        success(res, result);
    }),
};


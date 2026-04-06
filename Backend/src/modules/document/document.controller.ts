import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { success } from "../../utils/apiResponse";
import { documentService } from "./document.service";
import { uploadDocumentSchema } from "./document.validators";
import { checkImageQuality } from "../../services/imageQuality.service";
import { AppError } from "../../utils/AppError";
import { logger } from "../../config/logger";
import { dbInstances } from "@repo/db-customer";
import { storageService } from "../../services/storage.service";
import { dlVerificationService } from "../../services/dl-verification.service";
import { fastagVerificationService } from "./fastag.service";

const DEV_CUSTOMER_ID = "cmlj50qq00000ohti713c0bwy";

function getCustomerId(req: Request): string {
  if (req.customer?.id) return req.customer.id;
  return DEV_CUSTOMER_ID;
}

function parseBody<T>(
  req: Request,
  schema: {
    safeParse: (v: unknown) => {
      success: boolean;
      data?: T;
      error?: { issues: { message: string }[] };
    };
  },
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

    const customerId = getCustomerId(req);
    const customerExists = await dbInstances.customer.findUnique({
      where: { id: customerId },
    });
    if (!customerExists) {
      logger.error({ customerId }, "Customer not found in DB");
      throw AppError.badRequest("Customer not found");
    }
    logger.info({ customerId }, "Document upload initiated for customer");

    const body = parseBody(req, uploadDocumentSchema);
    const document = await documentService.uploadDocument(
      customerId,
      req.file,
      body,
    );

    success(res, document, 201);
  }),

  list: asyncHandler(async (req: Request, res: Response) => {
    const customerId = getCustomerId(req);
    const documents = await documentService.listDocuments(customerId);
    success(res, documents);
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const customerId = getCustomerId(req);
    const document = await documentService.getDocument(
      customerId,
      req.params.id as string,
    );
    success(res, document);
  }),

  delete: asyncHandler(async (req: Request, res: Response) => {
    const customerId = getCustomerId(req);
    const result = await documentService.deleteDocument(
      customerId,
      req.params.id as string,
    );
    success(res, result);
  }),

  getExpiring: asyncHandler(async (req: Request, res: Response) => {
    const customerId = getCustomerId(req);
    const days = req.query.days ? parseInt(req.query.days as string) : 30;
    const result = await documentService.getExpiringDocuments(
      customerId,
      days,
    );
    success(res, result);
  }),

  verify: asyncHandler(async (req: Request, res: Response) => {
    const customerId = getCustomerId(req);
    const result = await documentService.verifyDocument(
      customerId,
      req.params.id as string,
    );
    success(res, result);
  }),

  getImage: asyncHandler(async (req: Request, res: Response) => {
    const document = await dbInstances.vehicleDocument.findUnique({
      where: { id: req.params.id as string },
      select: { fileUrl: true, mimeType: true, type: true }
    });
    if (!document) {
      throw AppError.notFound("Image not found");
    }

    if (document.fileUrl) {
      const safeUrl = await storageService.ensureReadableUrl(document.fileUrl);
      if (safeUrl) return res.redirect(safeUrl);
    }

    // FALLBACK: If NO fileUrl (like verified DLs), return a generic document thumbnail
    // This prevents broken images in the app for verified digital documents
    return res.redirect('https://images.unsplash.com/photo-1586769852044-692d4f3b77da?w=400&h=400&fit=crop');
  }),

  // Generate and serve a PDF version for direct system download (avoids Android EACCES)
  getPDF: asyncHandler(async (req: Request, res: Response) => {
    const document = await dbInstances.vehicleDocument.findUnique({
      where: { id: req.params.id as string },
      select: { id: true, fileUrl: true, type: true, fileContent: true }
    });
    
    if (!document) {
      throw AppError.notFound("Document not found");
    }

    if (document.fileUrl) {
      const safeUrl = await storageService.ensureReadableUrl(document.fileUrl);
      if (safeUrl) return res.redirect(safeUrl);
    }

    // FALLBACK: For verified documents (JSON only), generate PDF placeholder
    // (Ideally we'd generate a real PDF from JSON here, but redirection is faster for now)
    return res.redirect('https://images.unsplash.com/photo-1586769852044-692d4f3b77da?w=800');
  }),

  /** Pre-upload image quality check (blur, glare). Returns { ok, hints }. */
  checkImageQuality: asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      throw AppError.badRequest("No file uploaded");
    }
    const mime = req.file.mimetype || "image/jpeg";
    const result = await checkImageQuality(req.file.buffer, mime);
    return success(res, result);
  }),

  verifyDL: asyncHandler(async (req: Request, res: Response) => {
    const { dlNumber, dob } = req.body;
    const customerId = getCustomerId(req);

    if (!dlNumber || !dob) {
      throw AppError.badRequest("DL number and DOB are required");
    }

    // 1. Call IDSPay
    const result = await dlVerificationService.verifyDL(dlNumber, dob);
    
    // LOG RESULT TO TERMINAL AS REQUESTED
    logger.info({ dlNumber, dob, result }, "DL Verification SUCCESS - Received Data from IDSPay");

    // 2. Save to DB using shared service
    try {
        const doc = await documentService.storeVerifiedDL(customerId, result, dlNumber);
        logger.info({ docId: doc.id }, "DL Document stored/updated in DB successfully");
    } catch (dbError: any) {
        logger.error({ dbError: dbError.message, customerId }, "Failed to store DL in DB");
        // We still return the result to the user so they see the data, even if storage failed temporarily
    }

    return success(res, result);
  }),

  /** Get existing verified DL */
  getDL: asyncHandler(async (req: Request, res: Response) => {
    const customerId = getCustomerId(req);
    const dl = await (dbInstances as any).drivingLicense.findUnique({
        where: { customerId },
    });
    
    if (!dl || !dl.rawResponse) {
        return success(res, null);
    }
    
    return success(res, dl.rawResponse);
  }),

  /** Delete existing DL */
  deleteDL: asyncHandler(async (req: Request, res: Response) => {
    const customerId = getCustomerId(req);
    await (dbInstances as any).drivingLicense.delete({
        where: { customerId }
    }).catch(() => {});
    return success(res, { success: true });
  }),

  /** Verify Fastag (IDSPay Bank Pennyless API) */
  verifyFastag: asyncHandler(async (req: Request, res: Response) => {
    const { creditorAccountId, ifscCode } = req.body;
    const customerId = getCustomerId(req);

    if (!creditorAccountId || !ifscCode) {
      throw AppError.badRequest("Account ID and IFSC are required");
    }

    // 1. Call IDSPay
    const result = await fastagVerificationService.verifyAccount(creditorAccountId, ifscCode);
    
    // LOG RESULT TO TERMINAL AS REQUESTED
    logger.info({ creditorAccountId, result }, "Fastag/Bank Verification SUCCESS");

    // 2. Save to DB
    try {
        await documentService.storeFastagVerification(customerId, result);
    } catch (saveError: any) {
        logger.error({ error: saveError.message }, "Failed to store Fastag verification");
    }

    return success(res, result);
  }),

  /** Get Fastag details */
  getFastag: asyncHandler(async (req: Request, res: Response) => {
    const customerId = getCustomerId(req);
    const db = dbInstances as any;
    
    // Defensive check to avoid unhandled TypeError if client is not in sync
    if (!db.fastagDocument) {
        logger.warn({ customerId }, "fastagDocument model missing from Prisma client - client/DB out of sync");
        return success(res, null);
    }

    const doc = await db.fastagDocument.findUnique({
        where: { customerId }
    });
    
    if (!doc || !doc.rawResponse) {
        return success(res, null);
    }
    
    return success(res, doc.rawResponse);
  }),

  /** Delete existing Fastag */
  deleteFastag: asyncHandler(async (req: Request, res: Response) => {
    const customerId = getCustomerId(req);
    const db = dbInstances as any;
    if (db.fastagDocument) {
        await db.fastagDocument.delete({
            where: { customerId }
        }).catch(() => {});
    }
    return success(res, { success: true });
  }),
};

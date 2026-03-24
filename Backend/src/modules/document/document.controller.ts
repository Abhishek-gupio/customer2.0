import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { success } from "../../utils/apiResponse";
import { documentService } from "./document.service";
import { uploadDocumentSchema } from "./document.validators";
import { checkImageQuality } from "../../services/imageQuality.service";
import { AppError } from "../../utils/AppError";
import { logger } from "../../config/logger";
import { dbInstances } from "@repo/db-customer";

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
      select: { fileContent: true, mimeType: true }
    });
    if (!document || !document.fileContent) {
      throw AppError.notFound("Image content not found");
    }
    res.setHeader("Content-Type", document.mimeType || "image/jpeg");
    res.send(document.fileContent);
  }),

  // Generate and serve a PDF version for direct system download (avoids Android EACCES)
  getPDF: asyncHandler(async (req: Request, res: Response) => {
    const document = await dbInstances.vehicleDocument.findUnique({
      where: { id: req.params.id as string },
      select: { id: true, fileContent: true, type: true }
    });
    
    if (!document || !document.fileContent) {
      throw AppError.notFound("Document not found");
    }
    
    const sharp = (await import("sharp")).default;
    const pdfBuffer = await sharp(document.fileContent as Buffer)
      .resize(1200) // reasonable resolution
      .toFormat("pdf")
      .toBuffer();

    const fileName = `${document.type.toLowerCase()}_${document.id}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.send(pdfBuffer);
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
};

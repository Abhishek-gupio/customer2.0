import { dbInstances } from "@repo/db-customer";
import { storageService } from "../../services/storage.service";
import { ocrService } from "../../services/ocr.service";
import { vehicleService } from "../vehicle/vehicle.service";
import { AppError } from "../../utils/AppError";
import { UploadDocumentInput } from "./document.validators";
import { logger } from "../../config/logger";

export const documentService = {
  async uploadDocument(
    customerId: string,
    file: Express.Multer.File,
    input: UploadDocumentInput,
  ) {
    // 1. Upload to S3
    const { url, key } = await storageService.uploadFile(
      file,
      `documents/${customerId}`,
    );

    // 1.5 Sanitize documentNumber for Swagger placeholders
    let finalDocNo = input.documentNumber;
    if (finalDocNo === "string" || !finalDocNo) {
      finalDocNo = undefined;
    }

    // 2. Check for duplicates in input
    if (finalDocNo) {
      const existing = await dbInstances.customerDocument.findFirst({
        where: {
          customerId,
          documentNumber: finalDocNo,
          type: input.type,
        },
      });
      if (existing) {
        throw AppError.conflict(
          "Document with this number already exists for this customer",
        );
      }
    }

    // 3. Optional: Run OCR
    let ocrData = null;
    let extractedFields: any = null;
    try {
      // Use AI-powered parsing with the image buffer
      extractedFields = await ocrService.parseDocument(
        file.buffer,
        file.mimetype,
      );
      ocrData = { raw: extractedFields.rawText || "AI Parsed" };
    } catch (err) {
      logger.warn({ err }, "OCR failed during document upload, skipping...");
    }

    // 3.5 AI Improvisation: Auto-link or Create Vehicle if it's an RC
    // Handle Swagger "string" placeholder or empty string
    let finalVehicleId: string | undefined = input.vehicleId;
    if (!finalVehicleId || finalVehicleId === "string") {
      finalVehicleId = undefined;
    }
    if (
      !finalVehicleId &&
      (input.type === "RC" || extractedFields?.type === "RC")
    ) {
      const regNo = finalDocNo || extractedFields?.documentNumber;
      if (regNo) {
        // Try to find existing vehicle by registration number
        const existingVehicle = await dbInstances.customerVehicle.findUnique({
          where: { registrationNumber: regNo },
        });

        if (existingVehicle) {
          finalVehicleId = existingVehicle.id;
          logger.info(
            { vehicleId: finalVehicleId },
            "Auto-linked document to existing vehicle found by Registration No",
          );

          // Optional: Update missing fields on existing vehicle from AI data
          if (extractedFields?.vehicleDetails) {
            await dbInstances.customerVehicle.update({
              where: { id: existingVehicle.id },
              data: {
                make:
                  existingVehicle.make || extractedFields.vehicleDetails.make,
                model:
                  existingVehicle.model || extractedFields.vehicleDetails.model,
                variant:
                  existingVehicle.variant ||
                  extractedFields.vehicleDetails.variant,
                fuelType:
                  existingVehicle.fuelType ||
                  extractedFields.vehicleDetails.fuelType,
                engineNumber:
                  (existingVehicle as any).engineNumber ||
                  extractedFields.vehicleDetails.engineNumber,
                chassisNumber:
                  (existingVehicle as any).chassisNumber ||
                  extractedFields.vehicleDetails.chassisNumber,
                registrationDate:
                  existingVehicle.registrationDate ||
                  (extractedFields.vehicleDetails.registrationDate
                    ? new Date(extractedFields.vehicleDetails.registrationDate)
                    : undefined),
                vehicleType:
                  existingVehicle.vehicleType ||
                  extractedFields.vehicleDetails.vehicleType,
              } as any,
            });
          }
        } else if (extractedFields?.vehicleDetails) {
          // Auto-create vehicle if AI found enough details
          try {
            const newVehicle = await vehicleService.addVehicle(customerId, {
              registrationNumber: regNo,
              make: extractedFields.vehicleDetails.make || "Unknown",
              model: extractedFields.vehicleDetails.model || "Unknown",
              variant: extractedFields.vehicleDetails.variant,
              year: extractedFields.vehicleDetails.registrationDate
                ? new Date(
                    extractedFields.vehicleDetails.registrationDate,
                  ).getFullYear()
                : undefined,
              fuelType: extractedFields.vehicleDetails.fuelType,
              registrationDate: extractedFields.vehicleDetails.registrationDate
                ? new Date(extractedFields.vehicleDetails.registrationDate)
                : undefined,
              engineNumber: extractedFields.vehicleDetails.engineNumber,
              chassisNumber: extractedFields.vehicleDetails.chassisNumber,
              vehicleType: extractedFields.vehicleDetails.vehicleType, // Map if available
            } as any);
            finalVehicleId = newVehicle.id;
            logger.info(
              { vehicleId: finalVehicleId },
              "Auto-created vehicle from uploaded RC using AI",
            );
          } catch (vErr) {
            logger.warn(
              { vErr },
              "Failed to auto-create vehicle from RC, proceeding with document only",
            );
          }
        }
      }
    }

    // 4. Save to DB
    const savedDocNo =
      finalDocNo || (extractedFields?.documentNumber as string);
    logger.info(
      { documentNumber: savedDocNo, type: input.type },
      "Saving document to database",
    );

    const document = await dbInstances.customerDocument.create({
      data: {
        customerId,
        vehicleId: finalVehicleId || null,
        type: input.type,
        documentNumber: savedDocNo,
        issueDate: input.issueDate ? new Date(input.issueDate) : undefined,
        expiryDate: input.expiryDate
          ? new Date(input.expiryDate)
          : extractedFields?.dates?.[0]
            ? new Date(extractedFields.dates[0])
            : undefined,
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
      where: {
        OR: [
          { customerId },
          { vehicle: { accessList: { some: { customerId } } } },
        ],
      },
      orderBy: { createdAt: "desc" },
    });
  },

  async getDocument(customerId: string, documentId: string) {
    const document = await dbInstances.customerDocument.findUnique({
      where: { id: documentId },
      include: {
        vehicle: {
          include: {
            accessList: {
              where: { customerId },
            },
          },
        },
      },
    });

    if (!document) throw AppError.notFound("Document not found");

    const isOwner = document.customerId === customerId;
    const hasSharedAccess = (document.vehicle?.accessList?.length || 0) > 0;

    if (!isOwner && !hasSharedAccess) {
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

  async verifyDocument(customerId: string, documentId: string) {
    await this.getDocument(customerId, documentId); // Verify ownership/access

    return dbInstances.customerDocument.update({
      where: { id: documentId },
      data: {
        verificationStatus: "VERIFIED",
        verifiedAt: new Date(),
        verifiedBy: `USER_${customerId}`,
      },
    });
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

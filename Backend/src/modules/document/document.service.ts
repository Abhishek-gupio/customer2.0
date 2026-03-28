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
    // 1. Check for duplicates (Simple version)
    if (input.documentNumber) {
      const existing = await dbInstances.vehicleDocument.findFirst({
        where: {
          customerId,
          documentNumber: input.documentNumber,
          type: input.type,
        },
      });
      if (existing) {
        throw AppError.conflict(
          "Document with this number already exists for this customer",
        );
      }
    }

    // 2. Save to Storage (S3 or Local per env)
    const { url: storageUrl } = await storageService.uploadFile(
      file,
      `documents/${customerId}`,
      true
    );

    // 3. Save to DB (Primary Storage in DB + metadata)
    const document = await dbInstances.vehicleDocument.create({
      data: {
        customerId,
        vehicleId: input.vehicleId || null,
        type: input.type,
        documentNumber: input.documentNumber,
        expiryDate: input.expiryDate ? new Date(input.expiryDate) : undefined,
        fileUrl: storageUrl, // Store storage URL
        mimeType: file.mimetype,
      },
      select: {
          id: true,
          customerId: true,
          vehicleId: true,
          type: true,
          documentNumber: true,
          expiryDate: true,
          fileUrl: true,
          mimeType: true,
          createdAt: true,
          updatedAt: true,
          // Exclude fileContent from standard JSON response to prevent payload issues
      }
    });

    if (document.vehicleId) {
      void vehicleService.calculateHealthScore(document.vehicleId).catch((err) =>
        logger.warn(
          { err, vehicleId: document.vehicleId, documentId: document.id },
          "Health recalculation failed after document upload",
        ),
      );
    }

    return {
      ...document,
      fileUrl: (await storageService.ensureReadableUrl(document.fileUrl || "")) || `/api/v1/documents/${document.id}/image`,
    };
  },

  async listDocuments(customerId: string) {
    const docs = await dbInstances.vehicleDocument.findMany({
      where: {
        OR: [
          { customerId },
          { vehicle: { accessList: { some: { customerId } } } },
        ],
      },
      select: {
          id: true,
          type: true,
          vehicleId: true,
          documentNumber: true,
          expiryDate: true,
          fileUrl: true,
          createdAt: true,
          vehicle: { select: { registrationNumber: true, make: true, model: true } }
      },
      orderBy: { createdAt: "desc" },
    });

    return Promise.all(docs.map(async (d) => ({
        ...d,
        fileUrl: (await storageService.ensureReadableUrl(d.fileUrl || "")) || `/api/v1/documents/${d.id}/image`
    })));
  },

  async getDocument(customerId: string, documentId: string) {
    const document = await dbInstances.vehicleDocument.findUnique({
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

    return {
        ...document,
        fileUrl: (await storageService.ensureReadableUrl(document.fileUrl || "")) || `/api/v1/documents/${document.id}/image`
    };
  },

  async deleteDocument(customerId: string, documentId: string) {
    const document = await this.getDocument(customerId, documentId);

    await dbInstances.vehicleDocument.delete({
      where: { id: documentId },
    });

    if (document.vehicleId) {
      void vehicleService.calculateHealthScore(document.vehicleId).catch((err) =>
        logger.warn(
          { err, vehicleId: document.vehicleId, documentId },
          "Health recalculation failed after document delete",
        ),
      );
    }

    return { success: true };
  },

  async verifyDocument(customerId: string, documentId: string) {
    await this.getDocument(customerId, documentId); // Verify ownership/access

    return { success: true, message: "Verification not needed in simplified schema" };
  },

  async getExpiringDocuments(customerId: string, days = 30) {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() + days);

    const docs = await dbInstances.vehicleDocument.findMany({
      where: {
        customerId,
        expiryDate: {
          not: null,
          lte: threshold,
          gte: new Date(),
        },
      },
      select: {
          id: true,
          type: true,
          vehicleId: true,
          documentNumber: true,
          expiryDate: true,
          fileUrl: true,
      },
      orderBy: { expiryDate: "asc" },
    });

    return Promise.all(docs.map(async (d) => ({
        ...d,
        fileUrl: (await storageService.ensureReadableUrl(d.fileUrl || "")) || `/api/v1/documents/${d.id}/image`
    })));
  },

  async storeVerifiedDL(customerId: string, dlData: any, manualNumber?: string) {
    logger.info({ customerId }, "Storing verified DL in DB");

    // Extract basic info
    // IDSPay/DigiLocker responses often come in a 'documents' or 'files' array
    const root = dlData.documents?.[0] || dlData.files?.[0] || dlData;
    const details = root.details_of_driving_licence || root.details_of_driving_license || root;
    const validity = root.dl_validity || details.dl_validity || root.validity;
    
    // Attempt to find number in various possible fields
    const dlNumber = manualNumber || details.dl_number || details.dl_no || details.doc_no || root.documentNumber;
    
    // Try to link to primary vehicle for better visibility in vehicle-related views (Legacy)
    const primaryVehicleId = await vehicleService.resolveVehicleId(customerId);

    return (dbInstances as any).drivingLicense.upsert({
        where: { customerId },
        update: {
            dlNumber,
            fullName: details.name || root.name,
            dob: root.dob || details.dob,
            referenceNumber: root.reference_no || details.last_transacted_at || root.last_transacted_at,
            dateOfIssue: details.date_of_issue || root.date_of_issue,
            originalLA: details.ola_name || root.ola_name,
            dateOfFirstIssue: details.date_of_first_issue || root.date_of_first_issue,
            validityNonTransport: validity?.non_transport?.to || root.expiry_date,
            validityTransport: validity?.transport?.to,
            registeredAddress: details.address || root.address,
            rawResponse: dlData as any,
            updatedAt: new Date(),
        },
        create: {
            customerId,
            dlNumber,
            fullName: details.name || root.name,
            dob: root.dob || details.dob,
            referenceNumber: root.reference_no || details.last_transacted_at || root.last_transacted_at,
            dateOfIssue: details.date_of_issue || root.date_of_issue,
            originalLA: details.ola_name || root.ola_name,
            dateOfFirstIssue: details.date_of_first_issue || root.date_of_first_issue,
            validityNonTransport: validity?.non_transport?.to || root.expiry_date,
            validityTransport: validity?.transport?.to,
            registeredAddress: details.address || root.address,
            rawResponse: dlData as any,
        },
    });
  },

  async storeFastagVerification(customerId: string, fastagData: any) {
    const root = fastagData.data?.beneValidationResp || fastagData;
    const resourceData = root.resourceData || {};

    logger.info({ customerId, creditorName: resourceData.creditorName }, "Storing verified Fastag/Bank result");

    const db = dbInstances as any;
    if (!db.fastagDocument) {
        logger.error({ customerId }, "Cannot store Fastag: fastagDocument model missing from Prisma client");
        return null;
    }

    return db.fastagDocument.upsert({
      where: { customerId },
      update: {
        creditorAccountId: resourceData.creditorAccountId,
        ifscCode: resourceData.ifscCode || "", // Fallback
        creditorName: resourceData.creditorName,
        transactionReferenceNumber: resourceData.transactionReferenceNumber,
        transactionId: resourceData.transactionId,
        status: root.metaData?.status || "SUCCESS",
        rawResponse: fastagData as any,
        updatedAt: new Date(),
      },
      create: {
        customerId,
        creditorAccountId: resourceData.creditorAccountId,
        ifscCode: resourceData.ifscCode || "", // Fallback
        creditorName: resourceData.creditorName,
        transactionReferenceNumber: resourceData.transactionReferenceNumber,
        transactionId: resourceData.transactionId,
        status: root.metaData?.status || "SUCCESS",
        rawResponse: fastagData as any,
      },
    });
  },
};

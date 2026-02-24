import { dbInstances } from "@repo/db-customer";
import { logger } from "../config/logger";
import { vectorService } from "./vector.service";
import { ocrService } from "./ocr.service";

const db = dbInstances as any;

/**
 * Service to automatically ingest new data into the AI's vector memory.
 * Runs in background to avoid blocking user requests.
 */
export const ingestionService = {
  /**
   * Ingest an expense into AI memory
   */
  async ingestExpense(expenseId: string) {
    try {
      const expense = await db.expense.findUnique({
        where: { id: expenseId },
        include: { vehicle: true },
      });

      if (!expense) return;

      // Construct meaningful text representation
      const dateStr = expense.date.toISOString().split("T")[0];
      const vehicleStr = expense.vehicle
        ? `for ${expense.vehicle.make} ${expense.vehicle.model} (${expense.vehicle.registrationNumber})`
        : "";
      const content = `Expense Record: Spent ₹${expense.amount} on ${expense.category} ${vehicleStr} on ${dateStr}. Merchant: ${expense.merchantName || "Unknown"}. Notes: ${expense.notes || "None"}.`;

      // Store embedding
      await vectorService.storeEmbedding({
        customerId: expense.customerId,
        entityId: expense.id,
        entityType: "EXPENSE",
        content,
      });

      logger.info({ expenseId }, "Expense ingested into AI memory");
    } catch (error) {
      logger.error({ error, expenseId }, "Failed to ingest expense");
    }
  },

  /**
   * Ingest a document (Policy/RC) into AI memory
   */
  async ingestDocument(documentId: string) {
    try {
      const doc = await db.customerDocument.findUnique({
        where: { id: documentId },
        include: { vehicle: true },
      });

      if (!doc) return;

      // Construct text
      const typeStr = doc.type;
      const vehicleStr = doc.vehicle
        ? `for ${doc.vehicle.make} ${doc.vehicle.model}`
        : "";
      const expiryStr = doc.expiryDate
        ? `Expires on ${doc.expiryDate.toISOString().split("T")[0]}`
        : "No expiry date";
      let details = "";

      // If OCR data exists, append it
      if (doc.extractedFields) {
        details = JSON.stringify(doc.extractedFields);
      }

      const content = `Document Record: ${typeStr} ${vehicleStr}. ${expiryStr}. Document Number: ${doc.documentNumber || "Unknown"}. Details: ${details}`;

      await vectorService.storeEmbedding({
        customerId: doc.customerId,
        entityId: doc.id,
        entityType: "DOCUMENT",
        content,
      });

      logger.info({ documentId }, "Document ingested into AI memory");
    } catch (error) {
      logger.error({ error, documentId }, "Failed to ingest document");
    }
  },

  /**
   * Ingest a vehicle profile
   */
  async ingestVehicle(vehicleId: string) {
    try {
      const vehicle = await db.customerVehicle.findUnique({
        where: { id: vehicleId },
      });

      if (!vehicle) return;

      const content = `Vehicle Profile: ${vehicle.make} ${vehicle.model} ${vehicle.variant || ""} (${vehicle.year}). Registration: ${vehicle.registrationNumber}. Fuel: ${vehicle.fuelType}. Current Odometer: ${vehicle.currentOdometer} km.`;

      await vectorService.storeEmbedding({
        customerId: vehicle.customerId,
        entityId: vehicle.id,
        entityType: "VEHICLE",
        content,
      });

      logger.info({ vehicleId }, "Vehicle profile ingested into AI memory");
    } catch (error) {
      logger.error({ error, vehicleId }, "Failed to ingest vehicle");
    }
  },
};

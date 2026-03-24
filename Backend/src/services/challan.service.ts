import axios from "axios";
import { dbInstances } from "@repo/db-customer";
import { logger } from "../config/logger";
import { notificationService } from "./notification.service";
import { env } from "../config/env";
import { AppError } from "../utils/AppError";

export const challanService = {
  /**
   * MOCK: Fetches any new challans for a car from an external source
   * In production, this would call E-Challan / Parivahan APIs.
   */
  async syncChallans(vehicleId: string) {
    const vehicle = await dbInstances.customerVehicle.findUnique({
      where: { id: vehicleId },
      include: { customer: true },
    });

    if (!vehicle) throw AppError.notFound("Vehicle not found");

    // Prisma schema includes ownerName/rto; cast if workspace client types lag behind schema.
    const vehicleRow = vehicle as typeof vehicle & {
      ownerName?: string | null;
      rto?: string | null;
    };

    logger.info(
      { vehicleId, regNo: vehicle.registrationNumber },
      "Checking for real-time traffic challans from idspay.in...",
    );

    const payload = {
      api_id: env.API_ID,
      api_key: env.API_KEY,
      token_id: env.TOKEN_ID,
      reg_no: vehicle.registrationNumber,
    };

    try {
      const response = await axios.post(
        "https://javabackend.idspay.in/api/v1/prod/srv2/validation/echallan",
        payload
      );

      const resData = response.data;
      console.log('--- RAW CHALLAN API DATA ---');
      console.log(JSON.stringify(resData, null, 2));
      console.log('-----------------------------');

      const resStatus = resData.status;
      const isSuccess = typeof resStatus === 'string' 
        ? resStatus === 'success' 
        : resStatus?.type === 'success';

      if (!isSuccess || !resData.data) {
        logger.error({ response: resData }, "Challan API returned error or empty status");
        return this.getChallans(vehicleId);
      }

      const externalChallans = Array.isArray(resData.data.data) ? resData.data.data : [];
      logger.info({ count: externalChallans.length }, "Discovered challans from external API");
      
      const syncedChallans = [];
      // Use owner/RTO from the first challan if available
      const first = externalChallans[0];
      const ownerName =
        first?.owner_name ||
        resData.data?.owner_name ||
        vehicleRow.ownerName ||
        vehicle.customer?.fullName ||
        null;
      const rtoName =
        first?.RTO_name || resData.data?.rto_name || vehicleRow.rto || null;

      for (const ec of externalChallans) {
        // Handle nested violation details
        let violationDescription = "Traffic Violation";
        if (Array.isArray(ec.violation_details)) {
            violationDescription = ec.violation_details
                .map((v: any) => v.offence)
                .join(" | ");
        } else {
            violationDescription = ec.offence_description || ec.offence || ec.reason || ec.violation || "Traffic Violation";
        }

        // Map external challan to our DB structure
        const challanData = {
          vehicleId,
          challanNumber: ec.challan_no || ec.challan_number || ec.challanNo || `CHL-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          amount: parseFloat(ec.challan_amount || ec.amount || ec.fine_amount || ec.fine || "0"),
          status: (ec.status || ec.challan_status || "UNPAID").toUpperCase() === "PAID" ? "PAID" : "UNPAID",
          date: ec.challan_date || ec.date || ec.violation_date ? new Date(ec.challan_date || ec.date || ec.violation_date) : new Date(),
          violationType: violationDescription,
          location: ec.challan_location || ec.location || ec.place || "Unknown",
          source: "IDSPAY E-CHALLAN",
          metadata: {
            ownerName: ec.owner_name || ownerName,
            rtoName: ec.RTO_name || rtoName,
            externalSource: "IDSPAY"
          }
        };

        const existing = await (dbInstances as any).challan.findUnique({
          where: { challanNumber: challanData.challanNumber },
        });

        if (existing) {
          const updated = await (dbInstances as any).challan.update({
            where: { id: existing.id },
            data: {
              status: challanData.status,
              amount: challanData.amount,
              updatedAt: new Date(),
              metadata: challanData.metadata
            },
          });
          syncedChallans.push(updated);
        } else {
          const created = await (dbInstances as any).challan.create({
            data: challanData,
          });
          syncedChallans.push(created);

          // Notify only for new UNPAID challans
          if (challanData.status === "UNPAID") {
            await notificationService.notifyCustomer(vehicle.customerId, {
              title: "⚠️ New Traffic Challan Found",
              body: `A new challan (${challanData.challanNumber}) of ₹${challanData.amount} for ${vehicle.make} ${vehicle.model} has been detected.`,
              type: "ERROR",
              sendSMS: false,
              link: `/vehicles/${vehicleId}/challans`,
            }).catch(err => logger.error({ err }, "Failed to send challan notification"));
          }
        }
      }

      return syncedChallans;
    } catch (error: any) {
      const code = String(error?.code ?? "");
      const isNetworkOrDns =
        code === "ENOTFOUND" ||
        code === "EAI_AGAIN" ||
        code === "ECONNREFUSED" ||
        code === "ETIMEDOUT";

      if (isNetworkOrDns) {
        logger.warn(
          { vehicleId, code, error: error?.message },
          "Challan provider unavailable; returning cached/local challans",
        );
      } else {
        logger.error(
          { vehicleId, code, error: error?.message },
          "Challan API call failed",
        );
      }

      // If API fails, return current local challans
      return this.getChallans(vehicleId);
    }
  },

  /**
   * Runs a full sync for all active vehicles
   * Usually triggered by a cron job
   */
  async syncAllVehicles() {
    const vehicles = await dbInstances.customerVehicle.findMany({
      where: { isActive: true },
    });

    for (const v of vehicles) {
      try {
        await this.syncChallans(v.id);
      } catch (err) {
        logger.error(
          { err, vehicleId: v.id },
          "Failed to sync challans for vehicle",
        );
      }
    }
  },

  async getChallans(vehicleId: string) {
    return (dbInstances as any).challan.findMany({
      where: { vehicleId },
      orderBy: { date: "desc" },
    });
  },

  async checkChallansByPlate(regNo: string) {
    logger.info({ regNo }, "Checking for one-time traffic challans via plate...");
    const payload = {
      api_id: env.API_ID,
      api_key: env.API_KEY,
      token_id: env.TOKEN_ID,
      reg_no: regNo,
    };

    try {
      const response = await axios.post(
        "https://javabackend.idspay.in/api/v1/prod/srv2/validation/echallan",
        payload
      );
      const resData = response.data;
      const resStatus = resData.status;
      const isSuccess = typeof resStatus === 'string' 
        ? resStatus === 'success' 
        : resStatus?.type === 'success';

      if (!isSuccess || !resData.data) return [];

      const externalChallans = Array.isArray(resData.data.data) ? resData.data.data : [];
      return externalChallans.map((ec: any) => ({
        id: ec.challan_no || `TMP-${Date.now()}`,
        challanNumber: ec.challan_no || "N/A",
        amount: parseFloat(ec.challan_amount || ec.amount || "0"),
        status: (ec.status || "UNPAID").toUpperCase(),
        date: ec.challan_date || new Date(),
        violationType: Array.isArray(ec.violation_details) 
          ? ec.violation_details.map((v: any) => v.offence).join(" | ")
          : ec.offence || "Traffic Violation",
        location: ec.challan_location || "Unknown",
        metadata: {
            ownerName: resData.data?.owner_name || "Unknown",
            rtoName: resData.data?.rto_name || "N/A"
        }
      }));
    } catch (error: any) {
      const code = String(error?.code ?? "");
      const isNetworkOrDns =
        code === "ENOTFOUND" ||
        code === "EAI_AGAIN" ||
        code === "ECONNREFUSED" ||
        code === "ETIMEDOUT";

      logger.error(
        { regNo, code, message: error?.message },
        "CheckChallansByPlate failed",
      );

      if (isNetworkOrDns) {
        throw new AppError(
          "Challan provider is temporarily unavailable. Please try again shortly.",
          503,
          "CHALLAN_PROVIDER_UNAVAILABLE",
        );
      }

      return [];
    }
  },

  async markAsPaid(challanId: string) {
    return (dbInstances as any).challan.update({
      where: { id: challanId },
      data: { status: "PAID", updatedAt: new Date() },
    });
  },
};

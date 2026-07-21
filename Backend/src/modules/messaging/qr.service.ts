import { randomBytes } from "crypto";
import { dbInstances } from "@repo/db-customer";
import { AppError } from "../../utils/AppError";

function generateToken(): string {
  return randomBytes(16).toString("base64url");
}

export const qrService = {
  /** Idempotent — returns the existing token if one exists, else creates one. Owner-only. */
  async getOrCreateToken(customerId: string, vehicleId: string) {
    const vehicle = await dbInstances.customerVehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle || vehicle.customerId !== customerId) {
      throw AppError.notFound("Vehicle not found");
    }
    const existing = await dbInstances.vehicleQrToken.findUnique({ where: { vehicleId } });
    if (existing) return existing;
    return dbInstances.vehicleQrToken.create({ data: { vehicleId, token: generateToken() } });
  },

  /** Invalidates the old QR — anyone who scans an old printed sticker gets a "not found" response. */
  async rotateToken(customerId: string, vehicleId: string) {
    const vehicle = await dbInstances.customerVehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle || vehicle.customerId !== customerId) {
      throw AppError.notFound("Vehicle not found");
    }
    return dbInstances.vehicleQrToken.upsert({
      where: { vehicleId },
      create: { vehicleId, token: generateToken() },
      update: { token: generateToken(), rotatedAt: new Date() },
    });
  },

  /**
   * Resolves a scanned token to just enough vehicle info to show a "Message
   * Owner" screen — registration/make/model only. Never the owner's phone,
   * email, or any other personal field.
   */
  async resolveToken(token: string) {
    const qrToken = await dbInstances.vehicleQrToken.findUnique({
      where: { token },
      include: {
        vehicle: {
          select: {
            id: true,
            registrationNumber: true,
            make: true,
            model: true,
            color: true,
            imageUrl: true,
            customer: {
              select: {
                fullName: true,
                phoneNumber: true,
              },
            },
          },
        },
      },
    });
    if (!qrToken) throw AppError.notFound("This QR code isn't linked to a vehicle");
    return {
      vehicleId: qrToken.vehicle.id,
      registrationNumber: qrToken.vehicle.registrationNumber,
      make: qrToken.vehicle.make,
      model: qrToken.vehicle.model,
      color: qrToken.vehicle.color,
      imageUrl: qrToken.vehicle.imageUrl,
      ownerName: qrToken.vehicle.customer?.fullName || null,
      phoneNumber: qrToken.vehicle.customer?.phoneNumber || null,
    };
  },
};

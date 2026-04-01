import { dbInstances } from "@repo/db-customer";
import { AppError } from "../../utils/AppError";
import { storageService } from "../../services/storage.service";
import { randomUUID } from "crypto";
import type {
  UpdateProfileInput,
  RegisterDeviceInput,
} from "./customer.validators";

type ProfileWithPic = { profilePic: string | null;[k: string]: unknown };
type RequestStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "CANCELLED" | "COMPLETED" | "RETURNED";
type VehicleStatus = "PARKED" | "PICKED_UP" | "IN_TRANSIT" | "RETURNED";
type LocationInput = { latitude: number; longitude: number; timestamp?: number };

const customerLocationCache = new Map<string, { latitude: number; longitude: number; timestamp: number }>();

function normalizePhone(phone: string | null | undefined): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  return digits.slice(-10);
}

function mapVehicleStatus(status: string | null | undefined): VehicleStatus {
  if (status === "PICKED_UP" || status === "IN_TRANSIT") return "IN_TRANSIT";
  if (status === "RETURNED") return "RETURNED";
  return "PARKED";
}

function requestMessage(status: string): string {
  switch (status) {
    case "ACCEPTED":
      return "Valet accepted your request.";
    case "REJECTED":
      return "Your request was rejected.";
    case "CANCELLED":
      return "Your request was cancelled.";
    case "COMPLETED":
    case "RETURNED":
      return "Vehicle delivered successfully.";
    default:
      return "Waiting for valet to accept your request.";
  }
}

async function getPublicCustomerForCustomerId(customerId: string) {
  const customer = await dbInstances.customer.findUnique({
    where: { id: customerId },
    select: { id: true, phoneNumber: true, email: true, fullName: true },
  });
  if (!customer) throw AppError.notFound("Customer not found");

  const normalizedPhone = normalizePhone(customer.phoneNumber);
  const publicCustomer = await dbInstances.public_Customer.findFirst({
    where: {
      OR: [
        customer.phoneNumber ? { phoneNumber: customer.phoneNumber } : undefined,
        normalizedPhone ? { phoneNumber: { endsWith: normalizedPhone } } : undefined,
        customer.email ? { email: customer.email } : undefined,
      ].filter(Boolean) as any[],
    },
    select: { id: true, fullName: true, phoneNumber: true },
  });
  if (publicCustomer) return publicCustomer;

  // Auto-link fallback: if no mapping exists in public.Customer, create one on demand.
  // This keeps valet flow working even when legacy public data is missing.
  const fallbackEmail =
    customer.email && customer.email.trim().length > 0
      ? customer.email.trim().toLowerCase()
      : `customer_${customer.id}@gupio.local`;
  const fallbackName =
    customer.fullName && customer.fullName.trim().length > 0
      ? customer.fullName.trim()
      : "Customer";

  try {
    return await dbInstances.public_Customer.create({
      data: {
        id: randomUUID(),
        fullName: fallbackName,
        email: fallbackEmail,
        phoneNumber: customer.phoneNumber,
        password: `migrated_${randomUUID()}`,
        updatedAt: new Date(),
        isActive: true,
      },
      select: { id: true, fullName: true, phoneNumber: true },
    });
  } catch {
    // If create fails due to unique races, re-read and return existing record.
    const retry = await dbInstances.public_Customer.findFirst({
      where: {
        OR: [
          { phoneNumber: customer.phoneNumber },
          normalizedPhone ? { phoneNumber: { endsWith: normalizedPhone } } : undefined,
          customer.email ? { email: customer.email } : undefined,
        ].filter(Boolean) as any[],
      },
      select: { id: true, fullName: true, phoneNumber: true },
    });
    if (retry) return retry;
    throw AppError.badRequest(
      "Unable to link customer with public schema. Please retry.",
    );
  }
}

async function resolveVehicle(publicCustomerPhone: string, vehicleNumber?: string) {
  if (vehicleNumber) {
    const vehicle = await dbInstances.vehicle.findUnique({
      where: { vehicleNumber: vehicleNumber.toUpperCase().trim() },
    });
    if (!vehicle) throw AppError.notFound("Vehicle not found");
    return vehicle;
  }

  const normalizedPhone = normalizePhone(publicCustomerPhone);
  const vehicle = await dbInstances.vehicle.findFirst({
    where: {
      OR: [
        publicCustomerPhone ? { ownerPhone: publicCustomerPhone } : undefined,
        normalizedPhone ? { ownerPhone: { endsWith: normalizedPhone } } : undefined,
      ].filter(Boolean) as any[],
    },
    orderBy: { updatedAt: "desc" },
  });
  if (!vehicle) {
    throw AppError.notFound("No vehicle found for this customer");
  }
  return vehicle;
}

async function withReadableProfilePic<T extends ProfileWithPic>(profile: T): Promise<T> {
  if (!profile.profilePic) return profile;
  const readable = await storageService.ensureReadableUrl(profile.profilePic);
  return { ...profile, profilePic: readable };
}

export const customerService = {
  async getProfile(customerId: string) {
    const customer = await dbInstances.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        phoneNumber: true,
        email: true,
        fullName: true,
        profilePic: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!customer) {
      throw AppError.notFound("Customer not found");
    }
    return withReadableProfilePic(customer);
  },

  async updateProfile(customerId: string, data: UpdateProfileInput) {
    const customer = await dbInstances.customer.update({
      where: { id: customerId },
      data: {
        email: data.email !== undefined ? (data.email.trim() || null) : undefined,
        fullName: data.fullName !== undefined ? (data.fullName.trim() || null) : undefined,
        profilePic: data.profilePic !== undefined ? (data.profilePic.trim() || null) : undefined,
        phoneNumber: data.phoneNumber !== undefined ? data.phoneNumber.trim() : undefined,
      },
      select: {
        id: true,
        phoneNumber: true,
        email: true,
        fullName: true,
        profilePic: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return withReadableProfilePic(customer);
  },

  /** Upload profile picture to storage (S3 or local per STORAGE_DRIVER) and set profilePic URL. */
  async uploadProfilePicture(
    customerId: string,
    file: Express.Multer.File,
  ) {
    const { url } = await storageService.uploadFile(
      file,
      `customers/${customerId}/profile`,
      true,
    );
    const customer = await dbInstances.customer.update({
      where: { id: customerId },
      data: { profilePic: url },
      select: {
        id: true,
        phoneNumber: true,
        email: true,
        fullName: true,
        profilePic: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return withReadableProfilePic(customer);
  },

  async registerDevice(customerId: string, data: RegisterDeviceInput) {
    const device = await dbInstances.customerDevice.create({
      data: {
        customerId,
        platform: data.platform,
        deviceToken: data.deviceToken ?? null,
        deviceInfo: data.deviceInfo ?? null,
      },
    });
    return device;
  },

  /** Counts for profile Quick Stats (vehicles, expenses, documents). Each count is safe: failure returns 0. */
  async getProfileStats(customerId: string) {
    const db = dbInstances as any;

    const countVehicles = () =>
      dbInstances.customerVehicle.count({ where: { customerId, isActive: true } }).catch(() => 0);

    const countExpenses = () =>
      (db.expense?.count?.({ where: { customerId } }) ?? Promise.resolve(0)).catch(() => 0);

    const countDocuments = () =>
      dbInstances.vehicleDocument.count({ where: { customerId } }).catch(() => 0);

    const [vehicles, expenses, documents] = await Promise.all([
      countVehicles(),
      countExpenses(),
      countDocuments(),
    ]);

    return {
      vehicles: Number(vehicles) || 0,
      expenses: Number(expenses) || 0,
      documents: Number(documents) || 0,
    };
  },

  async requestDrop(customerId: string, vehicleNumber?: string) {
    const publicCustomer = await getPublicCustomerForCustomerId(customerId);
    const vehicle = await resolveVehicle(publicCustomer.phoneNumber, vehicleNumber);

    const activeRequest = await dbInstances.customerRequest.findFirst({
      where: {
        customerId: publicCustomer.id,
        vehicleId: vehicle.id,
        status: { in: ["PENDING", "ACCEPTED"] },
      },
      orderBy: { createdAt: "desc" },
    });
    if (activeRequest) {
      return {
        hasRequest: true,
        requestStatus: activeRequest.status as RequestStatus,
        vehicleStatus: mapVehicleStatus(vehicle.status),
        requestType: activeRequest.requestType,
        vehicleNumber: vehicle.vehicleNumber,
        createdAt: activeRequest.createdAt,
        updatedAt: activeRequest.updatedAt,
        message: requestMessage(activeRequest.status),
      };
    }

    const created = await dbInstances.customerRequest.create({
      data: {
        id: randomUUID(),
        customerId: publicCustomer.id,
        vehicleId: vehicle.id,
        requestType: "DROPOFF",
        status: "PENDING",
        updatedAt: new Date(),
      },
    });

    return {
      hasRequest: true,
      requestStatus: created.status as RequestStatus,
      vehicleStatus: mapVehicleStatus(vehicle.status),
      requestType: created.requestType,
      vehicleNumber: vehicle.vehicleNumber,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
      message: "Drop request created successfully.",
    };
  },

  async getRequestStatus(customerId: string, vehicleNumber?: string) {
    const publicCustomer = await getPublicCustomerForCustomerId(customerId);
    const vehicle = vehicleNumber
      ? await resolveVehicle(publicCustomer.phoneNumber, vehicleNumber)
      : null;

    const latestRequest = await dbInstances.customerRequest.findFirst({
      where: {
        customerId: publicCustomer.id,
        ...(vehicle ? { vehicleId: vehicle.id } : {}),
      },
      include: { Vehicle: true },
      orderBy: { createdAt: "desc" },
    });

    if (!latestRequest) {
      return { hasRequest: false, message: "No active request found." };
    }

    return {
      hasRequest: true,
      requestStatus: latestRequest.status as RequestStatus,
      vehicleStatus: mapVehicleStatus(latestRequest.Vehicle.status),
      requestType: latestRequest.requestType,
      vehicleNumber: latestRequest.Vehicle.vehicleNumber,
      createdAt: latestRequest.createdAt,
      updatedAt: latestRequest.updatedAt,
      message: requestMessage(latestRequest.status),
    };
  },

  async getVehicleRequestData(customerId: string, vehicleNumber?: string) {
    const publicCustomer = await getPublicCustomerForCustomerId(customerId);
    const vehicle = vehicleNumber
      ? await resolveVehicle(publicCustomer.phoneNumber, vehicleNumber)
      : null;

    const latestRequest = await dbInstances.customerRequest.findFirst({
      where: {
        customerId: publicCustomer.id,
        ...(vehicle ? { vehicleId: vehicle.id } : {}),
      },
      include: { Vehicle: true },
      orderBy: { createdAt: "desc" },
    });

    if (!latestRequest) {
      return { hasRequest: false, message: "No active request found." };
    }

    const latestPickup = await dbInstances.pickup.findFirst({
      where: { vehicleId: latestRequest.vehicleId },
      include: {
        User_Pickup_valetIdToUser: { select: { fullName: true, phoneNumber: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const vehicleInfo = {
      vehicleNumberFull: latestRequest.Vehicle.vehicleNumber,
      vehicleNumberMasked: latestRequest.Vehicle.vehicleNumber,
      pickedBy: latestPickup?.User_Pickup_valetIdToUser?.fullName || "Not assigned",
      pickupTime: latestPickup?.pickupTime?.toISOString() || "Not scheduled",
      pickupLocation: latestPickup?.pickupFrom || latestPickup?.dropLocation || "Not available",
      vehicleType: latestRequest.Vehicle.vehicleType,
      vehicleModel: latestRequest.Vehicle.vehicleModel,
      vehicleColor: latestRequest.Vehicle.vehicleColor,
      ownerName: latestRequest.Vehicle.ownerName,
      ownerPhone: latestRequest.Vehicle.ownerPhone,
    };

    const pickupInfo = latestPickup
      ? {
        pickedBy: latestPickup.User_Pickup_valetIdToUser?.fullName || "Not assigned",
        valetPhone: latestPickup.User_Pickup_valetIdToUser?.phoneNumber || "N/A",
        pickupTime: latestPickup.pickupTime.toISOString(),
        pickupLocation: latestPickup.pickupFrom || "Not available",
        parkLocation: latestPickup.parkAt || "Not available",
        notes: latestPickup.notes || "",
        status: latestPickup.status,
      }
      : null;

    return {
      hasRequest: true,
      requestStatus: latestRequest.status as RequestStatus,
      vehicleStatus: mapVehicleStatus(latestRequest.Vehicle.status),
      requestType: latestRequest.requestType,
      vehicleNumber: latestRequest.Vehicle.vehicleNumber,
      createdAt: latestRequest.createdAt,
      updatedAt: latestRequest.updatedAt,
      message: requestMessage(latestRequest.status),
      vehicleInfo,
      pickupInfo,
    };
  },

  async cancelDropRequest(customerId: string, vehicleNumber?: string) {
    const publicCustomer = await getPublicCustomerForCustomerId(customerId);
    const vehicle = vehicleNumber
      ? await resolveVehicle(publicCustomer.phoneNumber, vehicleNumber)
      : null;

    const latestRequest = await dbInstances.customerRequest.findFirst({
      where: {
        customerId: publicCustomer.id,
        ...(vehicle ? { vehicleId: vehicle.id } : {}),
        status: { in: ["PENDING", "ACCEPTED"] },
      },
      include: { Vehicle: true },
      orderBy: { createdAt: "desc" },
    });

    if (!latestRequest) {
      return { hasRequest: false, message: "No active request to cancel." };
    }

    const updated = await dbInstances.customerRequest.update({
      where: { id: latestRequest.id },
      data: { status: "CANCELLED", updatedAt: new Date() },
      include: { Vehicle: true },
    });

    return {
      hasRequest: true,
      requestStatus: updated.status as RequestStatus,
      vehicleStatus: mapVehicleStatus(updated.Vehicle.status),
      requestType: updated.requestType,
      vehicleNumber: updated.Vehicle.vehicleNumber,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      message: "Request cancelled.",
    };
  },

  async getValetLocation(vehicleNumber: string) {
    const normalizedVehicle = vehicleNumber.toUpperCase().trim();
    const vehicle = await dbInstances.vehicle.findUnique({
      where: { vehicleNumber: normalizedVehicle },
      include: { Site: true },
    });
    if (!vehicle) throw AppError.notFound("Vehicle not found");

    const lat = vehicle.Site?.latitude ? Number(vehicle.Site.latitude) : NaN;
    const lng = vehicle.Site?.longitude ? Number(vehicle.Site.longitude) : NaN;
    const customerLocation = customerLocationCache.get(normalizedVehicle);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return {
        message: "Valet location unavailable right now.",
        dropCompleted: vehicle.status === "RETURNED",
      };
    }

    return {
      latitude: lat,
      longitude: lng,
      speed: 0,
      timestamp: Date.now(),
      dropCompleted: vehicle.status === "RETURNED",
      customerLocation: customerLocation ?? null,
    };
  },

  async upsertCustomerLocation(vehicleNumber: string, data: LocationInput) {
    const normalizedVehicle = vehicleNumber.toUpperCase().trim();
    customerLocationCache.set(normalizedVehicle, {
      latitude: data.latitude,
      longitude: data.longitude,
      timestamp: data.timestamp ?? Date.now(),
    });
    return { vehicleNumber: normalizedVehicle, ...customerLocationCache.get(normalizedVehicle)! };
  },
};

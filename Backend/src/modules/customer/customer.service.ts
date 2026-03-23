import { dbInstances } from "@repo/db-customer";
import { AppError } from "../../utils/AppError";
import { storageService } from "../../services/storage.service";
import type {
  UpdateProfileInput,
  RegisterDeviceInput,
} from "./customer.validators";

type ProfileWithPic = { profilePic: string | null; [k: string]: unknown };

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
      `profile/${customerId}`,
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
};

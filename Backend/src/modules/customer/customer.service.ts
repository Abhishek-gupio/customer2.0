import { dbInstances } from "@repo/db-customer";
import { AppError } from "../../utils/AppError";
import type { UpdateProfileInput, RegisterDeviceInput } from "./customer.validators";

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
    return customer;
  },

  async updateProfile(customerId: string, data: UpdateProfileInput) {
    const customer = await dbInstances.customer.update({
      where: { id: customerId },
      data: {
        email: data.email?.trim() || null,
        fullName: data.fullName?.trim() ?? undefined,
        profilePic: data.profilePic?.trim() || null,
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
    return customer;
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
};

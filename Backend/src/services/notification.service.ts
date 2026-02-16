import { dbInstances } from "@repo/db-customer";
import { getSMSService } from "./sms.service";
import { logger } from "../config/logger";
import cron from "node-cron";
import { challanService } from "./challan.service";

export const notificationService = {
  /**
   * Sends a push notification via FCM (Placeholder)
   */
  async sendPushNotification(
    customerId: string,
    title: string,
    body: string,
    metadata?: any,
  ) {
    const devices = await dbInstances.customerDevice.findMany({
      where: { customerId, deviceToken: { not: null } },
    });

    for (const device of devices) {
      logger.info(
        { customerId, token: device.deviceToken, title },
        "📱 [PUSH NOTIFICATION MOCK] Sent to device",
      );
      // Integration: admin.messaging().send(...) would go here
    }
  },

  /**
   * Creates an in-app notification
   */
  async createInAppNotification(
    customerId: string,
    input: {
      title: string;
      body: string;
      type: string;
      link?: string;
      metadata?: any;
    },
  ) {
    return (dbInstances as any).inAppNotification.create({
      data: {
        customerId,
        title: input.title,
        body: input.body,
        type: input.type,
        link: input.link,
        metadata: input.metadata || {},
      },
    });
  },

  /**
   * Send notification across all channels (Push + InApp + optionally SMS)
   */
  async notifyCustomer(
    customerId: string,
    payload: {
      title: string;
      body: string;
      type: string;
      link?: string;
      metadata?: any;
      sendSMS?: boolean;
      phoneNumber?: string;
    },
  ) {
    // 1. In-App
    await this.createInAppNotification(customerId, payload);

    // 2. Push
    await this.sendPushNotification(
      customerId,
      payload.title,
      payload.body,
      payload.metadata,
    );

    // 3. SMS (Optional)
    if (payload.sendSMS && payload.phoneNumber) {
      const smsService = getSMSService();
      await smsService.sendSMS(payload.phoneNumber, payload.body);
    }
  },

  /**
   * Scans for documents expiring soon (7, 15, 30 days) and sends notifications
   */
  async checkExpiringDocuments() {
    logger.info("Starting daily document expiry check...");

    // Check for 30, 15, and 7 days
    const intervals = [30, 15, 7];

    for (const days of intervals) {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + days);
      targetDate.setHours(0, 0, 0, 0);

      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);

      const expiringDocs = await dbInstances.customerDocument.findMany({
        where: {
          expiryDate: {
            gte: targetDate,
            lt: nextDay,
          },
        },
        include: {
          customer: true,
          vehicle: true,
        },
      });

      for (const doc of expiringDocs) {
        if (!doc.customer.phoneNumber) continue;

        const vehicleInfo = doc.vehicle
          ? `${doc.vehicle.make} ${doc.vehicle.model}`
          : "your vehicle";
        const title = "Document Expiry Reminder";
        const body = `Your ${doc.type} for ${vehicleInfo} is expiring in ${days} days (${doc.expiryDate?.toLocaleDateString()}). Please renew it soon. GUPIO.`;

        try {
          await this.notifyCustomer(doc.customerId, {
            title,
            body,
            type: "WARNING",
            sendSMS: true,
            phoneNumber: doc.customer.phoneNumber,
            link: `/documents/${doc.id}`,
            metadata: { docId: doc.id, vehicleId: doc.vehicleId },
          });
          logger.info(
            { customerId: doc.customerId, docId: doc.id },
            `Expiry notification (${days} days) processed`,
          );
        } catch (err) {
          logger.error(
            { err, docId: doc.id },
            "Failed to process expiry notification",
          );
        }
      }
    }
  },

  async getNotifications(customerId: string) {
    return (dbInstances as any).inAppNotification.findMany({
      where: { customerId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  },

  async markAsRead(customerId: string, notificationId: string) {
    return (dbInstances as any).inAppNotification.updateMany({
      where: { id: notificationId, customerId },
      data: { isRead: true, readAt: new Date() },
    });
  },

  /**
   * Initialize the background cron jobs
   */
  initCronJobs() {
    // Run daily at 10:00 AM
    cron.schedule("0 10 * * *", async () => {
      await this.checkExpiringDocuments();
      await challanService.syncAllVehicles();
    });

    logger.info(
      "Background cron jobs initialized (Docs & Challans Check at 10:00 AM)",
    );
  },
};

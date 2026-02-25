import { dbInstances } from "@repo/db-customer";
import { getSMSService } from "./sms.service";
import { logger } from "../config/logger";
import cron from "node-cron";
import { challanService } from "./challan.service";
import * as OneSignal from '@onesignal/node-onesignal';

// Initialize OneSignal with API keys from environment
const configuration = OneSignal.createConfiguration({
  restApiKey: process.env.ONESIGNAL_REST_API_KEY || '',
});
const onesignalClient = new OneSignal.DefaultApi(configuration);

export const notificationService = {
  /**
   * Send notification across all channels (Custom In-App, OneSignal Push, SMS Fallback)
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
    try {
      // 1. In-App Notification (Stored in Postgres)
      const inApp = await (dbInstances as any).inAppNotification.create({
        data: {
          customerId,
          title: payload.title,
          body: payload.body,
          type: payload.type,
          link: payload.link,
          metadata: payload.metadata || {},
        },
      });

      // Emit WebSocket event to the connected mobile app
      try {
        const { getIO } = require("../socket");
        getIO().to(customerId).emit("new_notification", inApp);
      } catch (wsError) {
        logger.error({ wsError, customerId }, "Failed to emit WebSocket notification");
      }

      // 2. OneSignal Push Notification
      if (process.env.ONESIGNAL_APP_ID && process.env.ONESIGNAL_REST_API_KEY) {
        const notification = new OneSignal.Notification();
        notification.app_id = process.env.ONESIGNAL_APP_ID;
        notification.include_aliases = { external_id: [customerId] }; // Send to specific customer via OneSignal external ID
        notification.target_channel = "push";
        notification.headings = { en: payload.title };
        notification.contents = { en: payload.body };
        notification.data = { type: payload.type, link: payload.link, ...payload.metadata };

        try {
          await onesignalClient.createNotification(notification);
          logger.info({ customerId, title: payload.title }, "Triggered OneSignal push notification.");
        } catch (pushErr) {
          logger.error({ err: pushErr, customerId }, "Failed to send OneSignal push");
        }
      } else {
        logger.warn("OneSignal API Keys not provided. Skipping Push Notification.");
      }

      // 3. SMS Fallback
      if (payload.sendSMS && payload.phoneNumber) {
        const smsService = getSMSService();
        await smsService.sendSMS(payload.phoneNumber, payload.body);
      }
    } catch (error) {
      logger.error({ error, customerId }, "Failed to complete notification delivery flow");
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

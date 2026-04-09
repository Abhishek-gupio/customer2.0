import { dbInstances } from "@repo/db-customer";
import { getSMSService } from "./sms.service";
import { logger } from "../config/logger";
import cron from "node-cron";
import { challanService } from "./challan.service";
import { telematicsService } from "./telematics.service";
import * as OneSignal from '@onesignal/node-onesignal';
import * as admin from 'firebase-admin'; // FCM

// Initialize OneSignal with API keys from environment
const configuration = OneSignal.createConfiguration({
  restApiKey: process.env.ONESIGNAL_REST_API_KEY || '',
});
const onesignalClient = new OneSignal.DefaultApi(configuration);

export const notificationService = {
  async cleanupOldNotifications() {
    const cutoff = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

    const result = await (dbInstances as any).inAppNotification.deleteMany({
      where: {
        createdAt: { lt: cutoff },
      },
    });

    logger.info(
      { deletedCount: result.count, cutoff: cutoff.toISOString() },
      "Old in-app notifications cleanup completed",
    );
  },

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

      // 4. Firebase Cloud Messaging (FCM)
      try {
        if (admin.apps.length > 0) {
          const devicesInProgress = await (dbInstances as any).customerDevice.findMany({
            where: { customerId, deviceToken: { not: null } },
          });

          if (devicesInProgress.length > 0) {
            const tokens = devicesInProgress.map((d: any) => d.deviceToken).filter(Boolean);
            const fcmPayload: admin.messaging.MulticastMessage = {
              tokens,
              notification: {
                title: payload.title,
                body: payload.body,
              },
              data: {
                type: payload.type,
                link: payload.link || "",
                metadata: JSON.stringify(payload.metadata || {}),
              },
              android: {
                priority: "high",
                notification: {
                  sound: "default",
                  channelId: "gupio_notifications", // Must match notification channels on Android
                },
              },
            };

            const response = await admin.messaging().sendEachForMulticast(fcmPayload);
            logger.info({ customerId, successCount: response.successCount, failureCount: response.failureCount }, "Triggered FCM multicast.");
            
            // Cleanup invalid tokens if any (optional; usually handled by failures)
            if (response.failureCount > 0) {
              response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                   logger.warn({ error: resp.error, token: tokens[idx] }, "FCM delivery failed for token");
                }
              });
            }
          }
        } else {
          logger.debug({ customerId }, "Skipping FCM: Firebase Admin not initialized");
        }
      } catch (fcmError) {
        logger.error({ fcmError, customerId }, "Failed to complete FCM delivery flow");
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

      const expiringDocs = await dbInstances.vehicleDocument.findMany({
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

  /**
   * Daily reminder: create one in-app (and push) notification per customer to update odometer.
   * Only one reminder per customer per calendar day.
   */
  async sendDailyOdometerReminders() {
    logger.info("Starting daily odometer update reminder...");

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const customersWithVehicles = await (dbInstances as any).customerVehicle.findMany({
      where: { isActive: true },
      select: { customerId: true },
      distinct: ["customerId"],
    });
    const customerIds: string[] = [
      ...new Set(
        (customersWithVehicles as { customerId: string }[]).map((v) => v.customerId)
      ),
    ];

    for (const customerId of customerIds) {
      try {
        const alreadySentToday = await (dbInstances as any).inAppNotification.findFirst({
          where: {
            customerId,
            type: "odometer",
            createdAt: { gte: todayStart },
          },
        });
        if (alreadySentToday) continue;

        await this.notifyCustomer(customerId, {
          title: "Update Odometer",
          body: "Log your current odometer reading for accurate service and warranty tracking.",
          type: "odometer",
          link: "/odometer",
          metadata: { source: "daily_reminder" },
        });
        logger.info({ customerId }, "Daily odometer reminder sent");
      } catch (err) {
        logger.error({ err, customerId }, "Failed to send daily odometer reminder");
      }
    }
    logger.info({ count: customerIds.length }, "Daily odometer reminders completed");
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

  async remove(customerId: string, notificationId: string) {
    return (dbInstances as any).inAppNotification.deleteMany({
      where: { id: notificationId, customerId },
    });
  },

  /**
   * Initialize the background cron jobs
   */
  initCronJobs() {
    // Run every day at 12:30 AM – delete in-app notifications older than 2 days
    cron.schedule("30 0 * * *", async () => {
      try {
        await this.cleanupOldNotifications();
      } catch (err) {
        logger.error({ err }, "Failed to cleanup old in-app notifications");
      }
    });

    // Run daily at 9:00 AM – odometer update reminder (one per customer per day)
    cron.schedule("0 9 * * *", async () => {
      await this.sendDailyOdometerReminders();
    });

    // Run daily at 10:00 AM – document expiry sync (Manual sync for now to avoid costs)
    cron.schedule("0 10 * * *", async () => {
      await this.checkExpiringDocuments();
      // await challanService.syncAllVehicles(); 
    });

    // Run every 5 minutes – Telematics Sync (Pull method)
    // Keep this OFF by default so Damoov sync only happens when explicitly triggered
    // (e.g. when you open the Driving Behavior screen or call /telematics/sync).
    if (String(process.env.TELEMATICS_SYNC_CRON_ENABLED).toLowerCase() === "true") {
      cron.schedule("*/5 * * * *", async () => {
        try {
          await telematicsService.syncTripsForAllDevices();
        } catch (err) {
          logger.error({ err }, "Periodic Telematics Sync failed");
        }
      });
      logger.info("Telematics periodic cron enabled (*/5 * * * *)");
    } else {
      logger.info("Telematics periodic cron disabled by default");
    }

    logger.info(
      "Background cron jobs initialized (Notification Cleanup 12:30 AM; Odometer 9 AM; Docs 10 AM; Telematics Every 5 Mins)",
    );
  },
};

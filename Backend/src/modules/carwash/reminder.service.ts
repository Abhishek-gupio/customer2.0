import { dbInstances } from "@repo/db-customer";
import { logger } from "../../config/logger";
import { notificationService } from "../../services/notification.service";
import { weatherService } from "../../services/weather.service";

/** Remind regardless of weather once it's been this long since the last wash. */
const MAX_DAYS_SINCE_WASH = 14;
/** A rained-recently reminder needs at least this many dust-accumulating days after the rain. */
const MIN_DAYS_AFTER_RAIN = 5;
const MIN_DAYS_AFTER_DUST = 7;
const RAIN_PRECIP_MM_THRESHOLD = 5;

function daysSince(date: Date | null): number | null {
  if (!date) return null;
  return Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000));
}

/** Best-effort — DrivingTrip.endLocation is a loosely-shaped JSON blob; not every key variant may be present. */
function extractLatLng(location: unknown): { latitude: number; longitude: number } | null {
  if (!location || typeof location !== "object") return null;
  const loc = location as Record<string, unknown>;
  const lat = Number(loc.Latitude ?? loc.latitude ?? loc.lat);
  const lng = Number(loc.Longitude ?? loc.longitude ?? loc.lng ?? loc.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { latitude: lat, longitude: lng };
}

/**
 * Rule-based v1 — the honest version of "AI predicts your wash." See
 * docs/gupio-carwash-platform-plan.md §9 for the growth path to a real model
 * once there's enough wash-frequency data to train on.
 */
export const reminderService = {
  async sendDailyWashReminders() {
    const vehicles = await dbInstances.customerVehicle.findMany({
      where: { isActive: true },
      select: { id: true, customerId: true, registrationNumber: true },
    });

    let sent = 0;
    for (const vehicle of vehicles) {
      try {
        const shouldRemind = await this.shouldRemindVehicle(vehicle.id);
        if (!shouldRemind) continue;

        await notificationService.notifyCustomer(vehicle.customerId, {
          title: "Your vehicle should be washed",
          body: shouldRemind.reason,
          type: "WASH_REMINDER",
          link: "/carwash/book",
          metadata: { vehicleId: vehicle.id },
        });
        sent++;
      } catch (err) {
        logger.error({ err, vehicleId: vehicle.id }, "Failed to evaluate/send wash reminder");
      }
    }
    if (sent > 0) logger.info({ sent }, "Sent daily wash reminders");
    return sent;
  },

  /** Exposed separately so it's independently testable without sending a notification. */
  async shouldRemindVehicle(vehicleId: string): Promise<{ reason: string } | null> {
    const lastWash = await dbInstances.washBooking.findFirst({
      where: { vehicleId, status: "COMPLETED" },
      orderBy: { completedAt: "desc" },
      select: { completedAt: true },
    });
    const sinceWash = daysSince(lastWash?.completedAt ?? null);

    if (sinceWash == null || sinceWash >= MAX_DAYS_SINCE_WASH) {
      return { reason: sinceWash == null ? "You haven't logged a wash yet" : `It's been ${sinceWash} days since your last wash` };
    }

    const lastTrip = await dbInstances.drivingTrip.findFirst({
      where: { vehicleId },
      orderBy: { endTime: "desc" },
      select: { endLocation: true },
    });
    const coords = extractLatLng(lastTrip?.endLocation);
    if (!coords) return null;

    const weather = await weatherService.getCurrentWeather(coords.latitude, coords.longitude);
    if (!weather) return null;

    if (weather.precip_mm > RAIN_PRECIP_MM_THRESHOLD && sinceWash >= MIN_DAYS_AFTER_RAIN) {
      return { reason: "Rain left your area dusty — time for a wash?" };
    }
    if (/dust|haze/i.test(weather.condition ?? "") && sinceWash >= MIN_DAYS_AFTER_DUST) {
      return { reason: "Dusty conditions nearby — your vehicle could use a wash" };
    }
    return null;
  },
};

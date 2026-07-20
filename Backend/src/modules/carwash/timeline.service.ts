import { dbInstances } from "@repo/db-customer";
import { AppError } from "../../utils/AppError";

export type TimelineEventType = "WASH" | "SERVICE" | "DOCUMENT" | "ODOMETER" | "CHALLAN";

export interface TimelineEvent {
  type: TimelineEventType;
  label: string;
  occurredAt: Date;
  meta?: Record<string, unknown>;
}

/**
 * Read-only aggregator across tables that already exist — no "Timeline"
 * table, no dual-write risk. See docs/gupio-carwash-platform-plan.md §10.
 * The only new event source this plan adds is WashBooking.completedAt.
 */
export const timelineService = {
  async getVehicleTimeline(customerId: string, vehicleId: string): Promise<TimelineEvent[]> {
    const vehicle = await dbInstances.customerVehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle || vehicle.customerId !== customerId) {
      throw AppError.notFound("Vehicle not found");
    }

    const [washes, services, documents, odometerLogs, challans] = await Promise.all([
      dbInstances.washBooking.findMany({
        where: { vehicleId, status: "COMPLETED" },
        select: { id: true, washType: true, completedAt: true },
      }),
      dbInstances.serviceRecord.findMany({
        where: { vehicleId },
        select: { id: true, serviceType: true, garageName: true, serviceDate: true },
      }),
      dbInstances.vehicleDocument.findMany({
        where: { vehicleId },
        select: { id: true, type: true, expiryDate: true, createdAt: true },
      }),
      dbInstances.odometerLog.findMany({
        where: { vehicleId },
        select: { id: true, reading: true, date: true },
        orderBy: { date: "desc" },
        take: 20,
      }),
      dbInstances.challan.findMany({
        where: { vehicleId },
        select: { id: true, violationType: true, amount: true, date: true },
      }),
    ]);

    const events: TimelineEvent[] = [
      ...washes
        .filter((w) => w.completedAt)
        .map((w) => ({
          type: "WASH" as const,
          label: `${w.washType.replace(/_/g, " ").toLowerCase()} wash completed`,
          occurredAt: w.completedAt as Date,
          meta: { bookingId: w.id },
        })),
      ...services.map((s) => ({
        type: "SERVICE" as const,
        label: s.garageName ? `${s.serviceType} at ${s.garageName}` : s.serviceType,
        occurredAt: s.serviceDate,
        meta: { serviceRecordId: s.id },
      })),
      ...documents.map((d) => ({
        type: "DOCUMENT" as const,
        label: `${d.type.replace(/_/g, " ").toLowerCase()} added`,
        occurredAt: d.createdAt,
        meta: { documentId: d.id, expiryDate: d.expiryDate },
      })),
      ...odometerLogs.map((o) => ({
        type: "ODOMETER" as const,
        label: `Odometer reading: ${o.reading} km`,
        occurredAt: o.date,
        meta: { odometerLogId: o.id },
      })),
      ...challans.map((c) => ({
        type: "CHALLAN" as const,
        label: `${c.violationType} — ₹${c.amount}`,
        occurredAt: c.date,
        meta: { challanId: c.id },
      })),
    ];

    return events.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
  },
};

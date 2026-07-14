jest.mock("../../config/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock("../../services/notification.service", () => ({
  notificationService: { notifyCustomer: jest.fn() },
}));

jest.mock("../../services/storage.service", () => ({
  storageService: { uploadFile: jest.fn() },
}));

jest.mock("../../services/payment-events", () => ({
  paymentEvents: {
    emitSucceeded: jest.fn(),
    emitFailed: jest.fn(),
    emitRefundProcessed: jest.fn(),
    onSucceeded: jest.fn(),
    onFailed: jest.fn(),
    onRefundProcessed: jest.fn(),
  },
}));

const mockCreateOrder = jest.fn();
const mockRefund = jest.fn();
jest.mock("../payments/payments.service", () => ({
  paymentsService: { createOrder: mockCreateOrder, refund: mockRefund, getCheckoutInfo: jest.fn() },
}));

jest.mock("@repo/db-customer", () => ({
  dbInstances: {
    parkingListing: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
    parkingSlotWindow: { findFirst: jest.fn(), findMany: jest.fn(), createMany: jest.fn() },
    parkingBooking: { create: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    parkingWaitlistEntry: { findMany: jest.fn(), upsert: jest.fn(), update: jest.fn() },
    parkingDealer: { findUnique: jest.fn(), create: jest.fn() },
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
  },
}));

import { dbInstances } from "@repo/db-customer";
import { parkingService } from "./parking.service";
import { paymentsService } from "../payments/payments.service";
import { AppError } from "../../utils/AppError";

const db = dbInstances as any;

const LISTING = { id: "listing_1", status: "ACTIVE", hourlyRatePaise: 5000 };
const SLOT_WINDOW = { id: "slot_1", listingId: "listing_1", startHour: 8, endHour: 20, capacity: 5, booked: 2 };

function bookingInput(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    listingId: "listing_1",
    startTime: new Date("2026-08-01T09:00:00.000Z"),
    endTime: new Date("2026-08-01T11:00:00.000Z"),
    ...overrides,
  } as any;
}

beforeEach(() => {
  db.parkingListing.findUnique.mockResolvedValue(LISTING);
  db.parkingSlotWindow.findFirst.mockResolvedValue(SLOT_WINDOW);
  db.$queryRaw.mockResolvedValue([{ id: SLOT_WINDOW.id }]); // reserveCapacity succeeds by default
  db.parkingBooking.findMany.mockResolvedValue([]); // no abandoned bookings to lazily expire, by default
  db.parkingWaitlistEntry.findMany.mockResolvedValue([]); // no one waitlisted, by default
});

describe("parkingService.createBooking — idempotency", () => {
  it("fast path: returns the existing booking instead of creating a new one when the key was already used", async () => {
    const existing = { id: "booking_1", customerId: "cust_1", orderId: "order_1", idempotencyKey: "key-abc" };
    db.parkingBooking.findUnique.mockResolvedValue(existing);
    (paymentsService.getCheckoutInfo as jest.Mock).mockResolvedValue({ orderId: "order_1", razorpayOrderId: "rzp_1" });

    const result = await parkingService.createBooking("cust_1", bookingInput({ idempotencyKey: "key-abc" }));

    expect(result.booking).toBe(existing);
    expect(db.parkingBooking.create).not.toHaveBeenCalled();
    expect(db.$queryRaw).not.toHaveBeenCalled(); // never even attempted a second reservation
  });

  it("rejects a replay of someone else's idempotency key", async () => {
    db.parkingBooking.findUnique.mockResolvedValue({ id: "booking_1", customerId: "someone_else" });

    await expect(
      parkingService.createBooking("cust_1", bookingInput({ idempotencyKey: "key-abc" })),
    ).rejects.toThrow(AppError);
    expect(db.parkingBooking.create).not.toHaveBeenCalled();
  });

  it("slow path: a genuinely concurrent duplicate loses the unique-constraint race and gets the winner's booking back", async () => {
    // No existing booking on the fast-path check (both requests race past it)...
    db.parkingBooking.findUnique
      .mockResolvedValueOnce(null) // fast-path check: not found yet
      .mockResolvedValueOnce({ id: "booking_winner", customerId: "cust_1", orderId: "order_winner" }); // re-fetch after losing the race

    // ...but the actual INSERT hits a unique constraint because the other request won.
    const p2002 = Object.assign(new Error("Unique constraint failed"), {
      code: "P2002",
      meta: { target: ["idempotencyKey"] },
    });
    db.parkingBooking.create.mockRejectedValue(p2002);
    (paymentsService.getCheckoutInfo as jest.Mock).mockResolvedValue({ orderId: "order_winner", razorpayOrderId: "rzp_2" });

    const result = await parkingService.createBooking("cust_1", bookingInput({ idempotencyKey: "key-race" }));

    expect(result.booking).toEqual({ id: "booking_winner", customerId: "cust_1", orderId: "order_winner" });
    // Released the capacity WE reserved, since the winner's reservation already stands.
    expect(db.$executeRaw).toHaveBeenCalled();
    // Never called Razorpay for the loser's booking.
    expect(mockCreateOrder).not.toHaveBeenCalled();
  });

  it("does not swallow unrelated DB errors from the create call", async () => {
    db.parkingBooking.findUnique.mockResolvedValue(null);
    db.parkingBooking.create.mockRejectedValue(new Error("connection reset"));

    await expect(
      parkingService.createBooking("cust_1", bookingInput({ idempotencyKey: "key-x" })),
    ).rejects.toThrow("connection reset");
  });
});

describe("parkingService.createBooking — capacity", () => {
  it("rejects when the slot fills up between lookup and reservation", async () => {
    db.parkingBooking.findUnique.mockResolvedValue(null);
    db.$queryRaw.mockResolvedValue([]); // reserveCapacity's UPDATE...RETURNING matched zero rows

    await expect(parkingService.createBooking("cust_1", bookingInput())).rejects.toThrow(
      "This time slot just filled up",
    );
    expect(db.parkingBooking.create).not.toHaveBeenCalled();
  });

  it("rejects when there's no availability at all for the requested window", async () => {
    db.parkingSlotWindow.findFirst.mockResolvedValue(null);
    await expect(parkingService.createBooking("cust_1", bookingInput())).rejects.toThrow(
      "No availability for this time window",
    );
  });

  it("releases the reservation and cancels the booking if order creation fails", async () => {
    db.parkingBooking.findUnique.mockResolvedValue(null);
    db.parkingBooking.create.mockResolvedValue({ id: "booking_2" });
    mockCreateOrder.mockRejectedValue(new Error("razorpay down"));

    await expect(parkingService.createBooking("cust_1", bookingInput())).rejects.toThrow("razorpay down");

    expect(db.$executeRaw).toHaveBeenCalled(); // capacity released
    expect(db.parkingBooking.update).toHaveBeenCalledWith({
      where: { id: "booking_2" },
      data: { status: "CANCELLED" },
    });
  });
});

describe("parkingService.cancelBooking", () => {
  it("refuses to cancel too close to the start time", async () => {
    const startsInFiveMinutes = new Date(Date.now() + 5 * 60 * 1000);
    db.parkingBooking.findUnique.mockResolvedValue({
      id: "booking_3",
      customerId: "cust_1",
      status: "CONFIRMED",
      startTime: startsInFiveMinutes,
    });

    await expect(parkingService.cancelBooking("cust_1", "booking_3")).rejects.toThrow(
      "Too close to the booking start time to cancel",
    );
  });

  it("cancels, releases capacity, and refunds a confirmed booking with plenty of notice", async () => {
    const startsInTwoHours = new Date(Date.now() + 2 * 60 * 60 * 1000);
    db.parkingBooking.findUnique.mockResolvedValue({
      id: "booking_4",
      customerId: "cust_1",
      status: "CONFIRMED",
      startTime: startsInTwoHours,
      listingId: "listing_1",
      slotWindowId: "slot_1",
      orderId: "order_4",
      amountPaise: 10000,
    });

    await parkingService.cancelBooking("cust_1", "booking_4");

    expect(db.parkingBooking.update).toHaveBeenCalledWith({
      where: { id: "booking_4" },
      data: { status: "CANCELLED" },
    });
    expect(mockRefund).toHaveBeenCalledWith("order_4", 10000, "Customer cancelled booking");
  });

  it("does not refund a booking that never got past PENDING_PAYMENT", async () => {
    const startsInTwoHours = new Date(Date.now() + 2 * 60 * 60 * 1000);
    db.parkingBooking.findUnique.mockResolvedValue({
      id: "booking_5",
      customerId: "cust_1",
      status: "PENDING_PAYMENT",
      startTime: startsInTwoHours,
      listingId: "listing_1",
      slotWindowId: "slot_1",
      orderId: null,
    });

    await parkingService.cancelBooking("cust_1", "booking_5");

    expect(mockRefund).not.toHaveBeenCalled();
  });

  it("rejects cancelling someone else's booking", async () => {
    db.parkingBooking.findUnique.mockResolvedValue({ id: "booking_6", customerId: "someone_else" });
    await expect(parkingService.cancelBooking("cust_1", "booking_6")).rejects.toThrow(AppError);
  });
});

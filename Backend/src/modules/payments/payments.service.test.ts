const mockOrdersCreate = jest.fn();
const mockPaymentsRefund = jest.fn();
const mockValidateWebhookSignature = jest.fn();
const mockValidatePaymentVerification = jest.fn();

jest.mock("razorpay", () => {
  const MockRazorpay: any = jest.fn().mockImplementation(() => ({
    orders: { create: mockOrdersCreate },
    payments: { refund: mockPaymentsRefund },
  }));
  MockRazorpay.validateWebhookSignature = mockValidateWebhookSignature;
  return MockRazorpay;
});

jest.mock("razorpay/dist/utils/razorpay-utils", () => ({
  validatePaymentVerification: mockValidatePaymentVerification,
}));

jest.mock("../../config/env", () => ({
  env: {
    RAZORPAY_KEY_ID: "rzp_test_key",
    RAZORPAY_KEY_SECRET: "test_secret",
    RAZORPAY_WEBHOOK_SECRET: "webhook_secret",
  },
}));

jest.mock("../../config/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
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

jest.mock("@repo/db-customer", () => ({
  dbInstances: {
    customerOrder: { create: jest.fn(), update: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    customerPaymentAttempt: { create: jest.fn(), upsert: jest.fn(), findFirst: jest.fn() },
    customerRefund: { create: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    webhookEvent: { upsert: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  },
}));

import { dbInstances } from "@repo/db-customer";
import { paymentEvents } from "../../services/payment-events";
import { paymentsService } from "./payments.service";
import { AppError } from "../../utils/AppError";

const db = dbInstances as any;

describe("paymentsService.createOrder", () => {
  it("creates a CustomerOrder, calls Razorpay, and returns checkout info", async () => {
    db.customerOrder.create.mockResolvedValue({ id: "order_1", amountPaise: 15000, currency: "INR" });
    mockOrdersCreate.mockResolvedValue({ id: "rzp_order_1" });
    db.customerOrder.update.mockResolvedValue({
      id: "order_1",
      razorpayOrderId: "rzp_order_1",
      status: "ATTEMPTED",
      amountPaise: 15000,
      currency: "INR",
    });

    const result = await paymentsService.createOrder("cust_1", {
      purpose: "PARKING_BOOKING",
      referenceId: "booking_1",
      amountPaise: 15000,
    });

    expect(mockOrdersCreate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 15000, currency: "INR", receipt: "order_1" }),
    );
    expect(result).toEqual({
      orderId: "order_1",
      razorpayOrderId: "rzp_order_1",
      amountPaise: 15000,
      currency: "INR",
      keyId: "rzp_test_key",
    });
  });

  it("marks the order FAILED and throws if Razorpay itself fails", async () => {
    db.customerOrder.create.mockResolvedValue({ id: "order_2", amountPaise: 15000, currency: "INR" });
    mockOrdersCreate.mockRejectedValue(new Error("network down"));

    await expect(
      paymentsService.createOrder("cust_1", { purpose: "PARKING_BOOKING", referenceId: "booking_2", amountPaise: 15000 }),
    ).rejects.toThrow(AppError);

    expect(db.customerOrder.update).toHaveBeenCalledWith({ where: { id: "order_2" }, data: { status: "FAILED" } });
  });
});

describe("paymentsService.getCheckoutInfo", () => {
  it("returns null when orderId is null", async () => {
    expect(await paymentsService.getCheckoutInfo(null)).toBeNull();
  });

  it("returns null when the order has no razorpayOrderId yet", async () => {
    db.customerOrder.findUnique.mockResolvedValue({ id: "order_3", razorpayOrderId: null });
    expect(await paymentsService.getCheckoutInfo("order_3")).toBeNull();
  });

  it("re-derives the checkout payload from an existing order", async () => {
    db.customerOrder.findUnique.mockResolvedValue({
      id: "order_4",
      razorpayOrderId: "rzp_order_4",
      amountPaise: 5000,
      currency: "INR",
    });
    expect(await paymentsService.getCheckoutInfo("order_4")).toEqual({
      orderId: "order_4",
      razorpayOrderId: "rzp_order_4",
      amountPaise: 5000,
      currency: "INR",
      keyId: "rzp_test_key",
    });
  });
});

describe("paymentsService.processWebhook", () => {
  const rawBody = Buffer.from(
    JSON.stringify({
      event: "payment.captured",
      payload: { payment: { entity: { id: "pay_1", order_id: "rzp_order_1", method: "upi" } } },
    }),
  );

  it("rejects and audit-logs a bad signature without processing the event", async () => {
    mockValidateWebhookSignature.mockReturnValue(false);
    db.webhookEvent.upsert.mockResolvedValue({ id: "evt_1" });

    await expect(paymentsService.processWebhook(rawBody, "bad-signature")).rejects.toThrow(AppError);

    expect(db.webhookEvent.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ signatureValid: false }) }),
    );
    expect(db.customerOrder.update).not.toHaveBeenCalled();
  });

  it("throws if the signature header is missing entirely", async () => {
    await expect(paymentsService.processWebhook(rawBody, undefined)).rejects.toThrow(AppError);
  });

  it("skips reprocessing an already-processed event (idempotent)", async () => {
    mockValidateWebhookSignature.mockReturnValue(true);
    db.webhookEvent.findUnique.mockResolvedValue({ id: "evt_1", processedAt: new Date() });

    const result = await paymentsService.processWebhook(rawBody, "good-signature");

    expect(result).toEqual({ deduped: true });
    expect(db.customerOrder.findUnique).not.toHaveBeenCalled();
  });

  it("confirms the order and emits payment.succeeded on first delivery of payment.captured", async () => {
    mockValidateWebhookSignature.mockReturnValue(true);
    db.webhookEvent.findUnique.mockResolvedValue(null);
    db.webhookEvent.upsert.mockResolvedValue({ id: "evt_2" });
    db.customerOrder.findUnique.mockResolvedValue({
      id: "order_1",
      status: "ATTEMPTED",
      purpose: "PARKING_BOOKING",
      referenceId: "booking_1",
      customerId: "cust_1",
      amountPaise: 15000,
    });

    const result = await paymentsService.processWebhook(rawBody, "good-signature");

    expect(result).toEqual({ deduped: false });
    expect(db.customerOrder.update).toHaveBeenCalledWith({ where: { id: "order_1" }, data: { status: "PAID" } });
    expect(paymentEvents.emitSucceeded).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: "order_1", purpose: "PARKING_BOOKING", referenceId: "booking_1" }),
    );
    expect(db.webhookEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "evt_2" }, data: expect.objectContaining({ processedAt: expect.any(Date) }) }),
    );
  });

  it("does not re-confirm (or double-emit) an order that's already PAID", async () => {
    mockValidateWebhookSignature.mockReturnValue(true);
    db.webhookEvent.findUnique.mockResolvedValue(null);
    db.webhookEvent.upsert.mockResolvedValue({ id: "evt_3" });
    db.customerOrder.findUnique.mockResolvedValue({ id: "order_1", status: "PAID" });

    await paymentsService.processWebhook(rawBody, "good-signature");

    expect(db.customerOrder.update).not.toHaveBeenCalled();
    expect(paymentEvents.emitSucceeded).not.toHaveBeenCalled();
  });
});

describe("paymentsService.refund", () => {
  it("refuses to refund an order that was never PAID", async () => {
    db.customerOrder.findUnique.mockResolvedValue({ id: "order_5", status: "ATTEMPTED" });
    await expect(paymentsService.refund("order_5", 15000)).rejects.toThrow(AppError);
  });

  it("processes a refund for a PAID order and emits refund.processed", async () => {
    db.customerOrder.findUnique.mockResolvedValue({
      id: "order_6",
      status: "PAID",
      purpose: "PARKING_BOOKING",
      referenceId: "booking_6",
      customerId: "cust_1",
    });
    db.customerPaymentAttempt.findFirst.mockResolvedValue({ razorpayPaymentId: "pay_6" });
    db.customerRefund.create.mockResolvedValue({ id: "refund_1" });
    mockPaymentsRefund.mockResolvedValue({ id: "rzp_refund_1" });

    const result = await paymentsService.refund("order_6", 15000, "customer cancelled");

    expect(mockPaymentsRefund).toHaveBeenCalledWith("pay_6", { amount: 15000 });
    expect(db.customerRefund.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "refund_1" }, data: expect.objectContaining({ status: "PROCESSED" }) }),
    );
    expect(paymentEvents.emitRefundProcessed).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: "order_6", amountPaise: 15000 }),
    );
    expect(result).toEqual({ id: "refund_1" });
  });
});

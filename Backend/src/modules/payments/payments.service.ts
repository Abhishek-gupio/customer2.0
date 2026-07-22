import Razorpay from "razorpay";
import { validatePaymentVerification } from "razorpay/dist/utils/razorpay-utils";
import { dbInstances, type PaymentPurpose } from "@repo/db-customer";
import { env } from "../../config/env";
import { AppError } from "../../utils/AppError";
import { logger } from "../../config/logger";
import { paymentEvents } from "../../services/payment-events";
import type { CreateOrderInput, VerifyOrderInput } from "./payments.validators";

let razorpayClient: Razorpay | null = null;

function getRazorpayClient(): Razorpay {
  if (razorpayClient) return razorpayClient;
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    throw AppError.internal(
      "Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.",
      "RAZORPAY_NOT_CONFIGURED",
    );
  }
  razorpayClient = new Razorpay({
    key_id: env.RAZORPAY_KEY_ID,
    key_secret: env.RAZORPAY_KEY_SECRET,
  });
  return razorpayClient;
}

export const paymentsService = {
  /**
   * `purpose` here is the full Prisma `PaymentPurpose` enum, not just
   * `CreateOrderInput['purpose']` — the latter is deliberately the narrower
   * set the public `POST /v1/payments/orders` endpoint's zod schema accepts
   * from a customer directly. Purposes only ever created server-side (e.g.
   * PARKING_EXTRA_CHARGE from parking.service.ts's checkoutBooking) must stay
   * out of that public enum, or a customer could self-create one for an
   * arbitrary referenceId/amount via the generic endpoint.
   */
  async createOrder(customerId: string, input: Omit<CreateOrderInput, "purpose"> & { purpose: PaymentPurpose }) {
    const razorpay = getRazorpayClient();

    const order = await dbInstances.customerOrder.create({
      data: {
        customerId,
        purpose: input.purpose,
        referenceId: input.referenceId,
        amountPaise: input.amountPaise,
        status: "CREATED",
      },
    });

    let razorpayOrder;
    try {
      razorpayOrder = await razorpay.orders.create({
        amount: input.amountPaise,
        currency: "INR",
        receipt: order.id,
        notes: { purpose: input.purpose, referenceId: input.referenceId, customerId },
      });
    } catch (err) {
      await dbInstances.customerOrder.update({
        where: { id: order.id },
        data: { status: "FAILED" },
      });
      logger.error({ err, orderId: order.id }, "Razorpay order creation failed");
      throw AppError.internal("Could not create payment order");
    }

    const updated = await dbInstances.customerOrder.update({
      where: { id: order.id },
      data: { razorpayOrderId: razorpayOrder.id, status: "ATTEMPTED" },
    });

    return {
      orderId: updated.id,
      razorpayOrderId: razorpayOrder.id,
      amountPaise: updated.amountPaise,
      currency: updated.currency,
      keyId: env.RAZORPAY_KEY_ID,
    };
  },

  async createWalkInPaymentLink(walkInId: string, amountPaise: number) {
    const razorpay = getRazorpayClient();
    try {
      // We generate a payment link which creates a short URL that can be shown as a QR.
      const paymentLink = await razorpay.paymentLink.create({
        amount: amountPaise,
        currency: "INR",
        accept_partial: false,
        description: "Parking Walk-in Payment",
        reference_id: walkInId,
        customer: { name: "Walk-in Customer", contact: "9999999999" },
        notes: { purpose: "PARKING_WALKIN_PAYMENT", walkInId },
      } as any);

      return {
        paymentLinkId: paymentLink.id,
        shortUrl: paymentLink.short_url,
      };
    } catch (err) {
      logger.error({ err, walkInId }, "Razorpay payment link creation failed");
      throw AppError.internal("Could not create payment link");
    }
  },

  async getOrder(customerId: string, orderId: string) {
    const order = await dbInstances.customerOrder.findUnique({
      where: { id: orderId },
      include: { attempts: true, refunds: true },
    });
    if (!order || order.customerId !== customerId) {
      throw AppError.notFound("Order not found");
    }
    return order;
  },

  async listHistory(customerId: string) {
    return dbInstances.customerOrder.findMany({
      where: { customerId },
      include: { refunds: true },
      orderBy: { createdAt: "desc" },
    });
  },

  /**
   * Ops visibility: support/admin staff couldn't otherwise see a payment
   * stuck without a webhook ever arriving, short of querying the DB by hand.
   */
  async adminListOrders(filters: { status?: string; stuckOnly?: boolean; page?: number; limit?: number }) {
    const page = Math.max(filters.page ?? 1, 1);
    const limit = Math.min(Math.max(filters.limit ?? 25, 1), 100);
    const stuckCutoff = new Date(Date.now() - 15 * 60 * 1000);

    const where: Record<string, unknown> = {};
    if (filters.stuckOnly) {
      where.status = { in: ["CREATED", "ATTEMPTED"] };
      where.createdAt = { lt: stuckCutoff };
    } else if (filters.status) {
      where.status = filters.status;
    }

    const [orders, total] = await Promise.all([
      dbInstances.customerOrder.findMany({
        where,
        include: {
          customer: { select: { id: true, fullName: true, phoneNumber: true } },
          attempts: { orderBy: { createdAt: "desc" }, take: 1 },
          refunds: true,
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      dbInstances.customerOrder.count({ where }),
    ]);

    return {
      data: orders.map((order) => ({
        ...order,
        isStuck: (order.status === "CREATED" || order.status === "ATTEMPTED") && order.createdAt < stuckCutoff,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },

  /**
   * Re-derives the same checkout payload a client would have gotten from
   * createOrder, without calling Razorpay again — used when a booking
   * create request is replayed (idempotency) and the order already exists.
   */
  async getCheckoutInfo(orderId: string | null) {
    if (!orderId) return null;
    const order = await dbInstances.customerOrder.findUnique({ where: { id: orderId } });
    if (!order?.razorpayOrderId) return null;
    return {
      orderId: order.id,
      razorpayOrderId: order.razorpayOrderId,
      amountPaise: order.amountPaise,
      currency: order.currency,
      keyId: env.RAZORPAY_KEY_ID,
    };
  },

  /**
   * Client-side check, called right after Razorpay checkout succeeds. The
   * webhook (processWebhook below) is still the source of truth and will
   * arrive independently, but this reconciles `CustomerOrder`/booking status
   * synchronously too — otherwise a delayed or misconfigured webhook (e.g. a
   * dashboard webhook URL not reachable from this environment) leaves a
   * booking stuck showing "pending payment" indefinitely despite a captured
   * payment. Reuses the same order-transition path as the webhook so a
   * later webhook delivery for the same payment is a no-op (order already
   * PAID) rather than a double-confirmation.
   */
  async verifyOrder(customerId: string, orderId: string, input: VerifyOrderInput) {
    const order = await this.getOrder(customerId, orderId);
    if (!order.razorpayOrderId) {
      throw AppError.badRequest("Order has no Razorpay order to verify");
    }
    if (!env.RAZORPAY_KEY_SECRET) {
      throw AppError.internal("Razorpay is not configured");
    }

    const valid = validatePaymentVerification(
      { order_id: order.razorpayOrderId, payment_id: input.razorpayPaymentId },
      input.razorpaySignature,
      env.RAZORPAY_KEY_SECRET,
    );

    // upsert, not create: this same razorpayPaymentId may already have a row
    // from the webhook (which usually wins the race) or from the client
    // retrying this call — either way it's the same attempt, not a new one.
    await dbInstances.customerPaymentAttempt.upsert({
      where: { razorpayPaymentId: input.razorpayPaymentId },
      create: {
        orderId: order.id,
        razorpayPaymentId: input.razorpayPaymentId,
        razorpaySignature: input.razorpaySignature,
        status: valid ? "SUCCESS" : "FAILED",
        paidAt: valid ? new Date() : undefined,
      },
      update: {
        status: valid ? "SUCCESS" : "FAILED",
        paidAt: valid ? new Date() : undefined,
      },
    });

    if (valid && order.status !== "PAID") {
      await this.markOrderPaid(order.id);
    }

    return { valid };
  },

  /**
   * Shared by the webhook's payment.captured/order.paid handling and
   * verifyOrder's client-side fallback — both are ways of learning "this
   * order's payment succeeded" and must converge on the same transition.
   */
  async markOrderPaid(orderId: string): Promise<void> {
    const order = await dbInstances.customerOrder.updateMany({
      where: { id: orderId, status: { not: "PAID" } },
      data: { status: "PAID" },
    });
    if (order.count === 0) return; // already marked PAID by a concurrent caller

    const updated = await dbInstances.customerOrder.findUniqueOrThrow({ where: { id: orderId } });
    paymentEvents.emitSucceeded({
      purpose: updated.purpose,
      referenceId: updated.referenceId,
      orderId: updated.id,
      customerId: updated.customerId,
      amountPaise: updated.amountPaise,
    });
  },

  /** Called in-process by other modules (e.g. Parking cancellation) — never over HTTP. */
  async refund(orderId: string, amountPaise: number, reason?: string) {
    const razorpay = getRazorpayClient();
    const order = await dbInstances.customerOrder.findUnique({ where: { id: orderId } });
    if (!order) throw AppError.notFound("Order not found");
    if (order.status !== "PAID") {
      throw AppError.badRequest("Only a paid order can be refunded");
    }

    const successfulAttempt = await dbInstances.customerPaymentAttempt.findFirst({
      where: { orderId, status: "SUCCESS" },
      orderBy: { paidAt: "desc" },
    });
    if (!successfulAttempt?.razorpayPaymentId) {
      throw AppError.internal("No successful payment attempt found to refund");
    }

    const refund = await dbInstances.customerRefund.create({
      data: { orderId, amountPaise, reason, status: "INITIATED" },
    });

    try {
      const rzpRefund = await razorpay.payments.refund(successfulAttempt.razorpayPaymentId, {
        amount: amountPaise,
      });
      await dbInstances.customerRefund.update({
        where: { id: refund.id },
        data: { razorpayRefundId: rzpRefund.id, status: "PROCESSED", processedAt: new Date() },
      });
    } catch (err) {
      await dbInstances.customerRefund.update({
        where: { id: refund.id },
        data: { status: "FAILED" },
      });
      logger.error({ err, orderId }, "Razorpay refund failed");
      throw AppError.internal("Refund could not be processed");
    }

    paymentEvents.emitRefundProcessed({
      purpose: order.purpose,
      referenceId: order.referenceId,
      orderId: order.id,
      customerId: order.customerId,
      amountPaise,
    });

    return refund;
  },

  /**
   * Signature-verified, idempotent processing of inbound Razorpay webhooks.
   * `rawBody` must be the exact bytes Razorpay signed — see app.ts's
   * express.json() `verify` hook, which stashes it on `req.rawBody`.
   */
  async processWebhook(rawBody: Buffer, signatureHeader: string | undefined) {
    if (!env.RAZORPAY_WEBHOOK_SECRET) {
      throw AppError.internal("RAZORPAY_WEBHOOK_SECRET is not configured");
    }
    if (!signatureHeader) {
      throw AppError.badRequest("Missing X-Razorpay-Signature header");
    }

    const rawBodyString = rawBody.toString("utf8");
    const signatureValid = Razorpay.validateWebhookSignature(
      rawBodyString,
      signatureHeader,
      env.RAZORPAY_WEBHOOK_SECRET,
    );

    const payload = JSON.parse(rawBodyString);
    const eventType: string = payload.event ?? "unknown";
    const entityId: string =
      payload?.payload?.payment?.entity?.id ??
      payload?.payload?.refund?.entity?.id ??
      payload?.payload?.order?.entity?.id ??
      "no-entity-id";
    const dedupeKey = `${eventType}:${entityId}`;

    if (!signatureValid) {
      logger.warn({ eventType, dedupeKey }, "Razorpay webhook signature invalid");
      await dbInstances.webhookEvent.upsert({
        where: { dedupeKey },
        create: { eventType, dedupeKey, payload, signatureValid: false },
        update: {},
      });
      throw AppError.unauthorized("Invalid webhook signature");
    }

    const existing = await dbInstances.webhookEvent.findUnique({ where: { dedupeKey } });
    if (existing?.processedAt) {
      logger.info({ dedupeKey }, "Razorpay webhook already processed — skipping");
      return { deduped: true };
    }

    const event = await dbInstances.webhookEvent.upsert({
      where: { dedupeKey },
      create: { eventType, dedupeKey, payload, signatureValid: true },
      update: { payload, signatureValid: true },
    });

    await this.applyWebhookEvent(eventType, payload);

    await dbInstances.webhookEvent.update({
      where: { id: event.id },
      data: { processedAt: new Date() },
    });

    return { deduped: false };
  },

  async applyWebhookEvent(eventType: string, payload: any): Promise<void> {
    if (eventType === "payment.link.paid") {
      const notes = payload?.payload?.payment_link?.entity?.notes;
      if (notes?.purpose === "PARKING_WALKIN_PAYMENT" && notes?.walkInId) {
        // This is the moment the money actually arrived — checkOutWalkIn only
        // *creates* the payment link and sets the customer's chosen method,
        // it can't know whether they ever actually paid it. Only this webhook
        // firing means the walk-in is real, collected revenue.
        await dbInstances.parkingWalkIn.update({
          where: { id: notes.walkInId },
          data: { paymentMethod: "ONLINE", onlinePaymentConfirmedAt: new Date() },
        });
        logger.info({ walkInId: notes.walkInId }, "WalkIn Payment Link Paid");
        paymentEvents.emitWalkInPaymentConfirmed({ walkInId: notes.walkInId });
      }
      return;
    }

    if (eventType === "payment.captured" || eventType === "order.paid") {
      const paymentEntity = payload?.payload?.payment?.entity;
      const razorpayOrderId: string | undefined = paymentEntity?.order_id;
      if (!razorpayOrderId) return;

      const order = await dbInstances.customerOrder.findUnique({
        where: { razorpayOrderId },
      });
      if (!order) {
        logger.warn({ razorpayOrderId }, "Webhook: no matching CustomerOrder");
        return;
      }
      if (order.status === "PAID") return; // already handled by an earlier delivery, or by verifyOrder's fallback

      await dbInstances.customerPaymentAttempt.upsert({
        where: { razorpayPaymentId: paymentEntity.id },
        create: {
          orderId: order.id,
          razorpayPaymentId: paymentEntity.id,
          method: paymentEntity.method,
          status: "SUCCESS",
          paidAt: new Date(),
        },
        update: { status: "SUCCESS", paidAt: new Date() },
      });
      await this.markOrderPaid(order.id);
      return;
    }

    if (eventType === "payment.failed") {
      const paymentEntity = payload?.payload?.payment?.entity;
      const razorpayOrderId: string | undefined = paymentEntity?.order_id;
      if (!razorpayOrderId) return;

      const order = await dbInstances.customerOrder.findUnique({
        where: { razorpayOrderId },
      });
      if (!order || order.status === "PAID") return;

      await dbInstances.customerPaymentAttempt.upsert({
        where: { razorpayPaymentId: paymentEntity.id },
        create: {
          orderId: order.id,
          razorpayPaymentId: paymentEntity.id,
          method: paymentEntity.method,
          status: "FAILED",
          failureReason: paymentEntity.error_description ?? undefined,
        },
        update: { status: "FAILED", failureReason: paymentEntity.error_description ?? undefined },
      });
      await dbInstances.customerOrder.update({
        where: { id: order.id },
        data: { status: "FAILED" },
      });

      paymentEvents.emitFailed({
        purpose: order.purpose,
        referenceId: order.referenceId,
        orderId: order.id,
        customerId: order.customerId,
        failureReason: paymentEntity.error_description ?? undefined,
      });
      return;
    }

    if (eventType === "refund.processed") {
      const refundEntity = payload?.payload?.refund?.entity;
      if (!refundEntity) return;
      await dbInstances.customerRefund.updateMany({
        where: { razorpayRefundId: refundEntity.id },
        data: { status: "PROCESSED", processedAt: new Date() },
      });
      return;
    }

    logger.info({ eventType }, "Razorpay webhook: no handler for this event type — ignored");
  },
};

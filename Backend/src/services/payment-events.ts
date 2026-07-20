import { EventEmitter } from "events";
import type { PaymentPurpose } from "@repo/db-customer";

export interface PaymentSucceededEvent {
  purpose: PaymentPurpose;
  referenceId: string;
  orderId: string;
  customerId: string;
  amountPaise: number;
}

export interface PaymentFailedEvent {
  purpose: PaymentPurpose;
  referenceId: string;
  orderId: string;
  customerId: string;
  failureReason?: string;
}

export interface RefundProcessedEvent {
  purpose: PaymentPurpose;
  referenceId: string;
  orderId: string;
  customerId: string;
  amountPaise: number;
}

/**
 * In-process pub/sub so payments.service.ts never imports a specific
 * feature's service (parking, accessories, ...). Each feature module
 * subscribes and filters on `purpose` — this is the only coupling between
 * Payments and whatever it's paying for.
 */
class PaymentEvents extends EventEmitter {
  emitSucceeded(event: PaymentSucceededEvent): void {
    this.emit("payment.succeeded", event);
  }
  onSucceeded(listener: (event: PaymentSucceededEvent) => void): void {
    this.on("payment.succeeded", listener);
  }

  emitFailed(event: PaymentFailedEvent): void {
    this.emit("payment.failed", event);
  }
  onFailed(listener: (event: PaymentFailedEvent) => void): void {
    this.on("payment.failed", listener);
  }

  emitRefundProcessed(event: RefundProcessedEvent): void {
    this.emit("refund.processed", event);
  }
  onRefundProcessed(listener: (event: RefundProcessedEvent) => void): void {
    this.on("refund.processed", listener);
  }
}

export const paymentEvents = new PaymentEvents();

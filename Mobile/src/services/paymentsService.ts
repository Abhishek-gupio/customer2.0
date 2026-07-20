import { api } from './api';

export interface PaymentOrder {
  id: string;
  purpose: string;
  referenceId: string;
  amountPaise: number;
  currency: string;
  status: 'CREATED' | 'ATTEMPTED' | 'PAID' | 'FAILED' | 'CANCELLED';
  razorpayOrderId: string | null;
  createdAt: string;
}

export interface VerifyOrderResult {
  valid: boolean;
}

function unwrap<T>(res: { data?: T } | T): T {
  return ((res as any)?.data ?? res) as T;
}

export const paymentsService = {
  getOrder: async (orderId: string): Promise<PaymentOrder> => {
    const res = await api.get<{ data?: PaymentOrder }>(`/v1/payments/orders/${orderId}`);
    return unwrap<PaymentOrder>(res);
  },

  /** Optional fast client-side check right after checkout; the webhook remains the source of truth. */
  verifyOrder: async (
    orderId: string,
    input: { razorpayPaymentId: string; razorpaySignature: string },
  ): Promise<VerifyOrderResult> => {
    const res = await api.post<{ data?: VerifyOrderResult }>(`/v1/payments/orders/${orderId}/verify`, input);
    return unwrap<VerifyOrderResult>(res);
  },

  listHistory: async (): Promise<PaymentOrder[]> => {
    const res = await api.get<{ data?: PaymentOrder[] }>('/v1/payments/history');
    const data = unwrap<PaymentOrder[]>(res);
    return Array.isArray(data) ? data : [];
  },
};

export interface RazorpayCheckoutParams {
  keyId: string;
  razorpayOrderId: string;
  amountPaise: number;
  currency: string;
  name: string;
  description?: string;
  prefillPhone?: string;
}

export interface RazorpayCheckoutSuccess {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

/**
 * Wraps react-native-razorpay's native checkout modal. Requires native
 * linking (iOS pod install / Android gradle sync) — this is the one part
 * of the Parking/Payments build that needs a native rebuild, not just JS.
 */
export async function openRazorpayCheckout(params: RazorpayCheckoutParams): Promise<RazorpayCheckoutSuccess> {
  const RazorpayCheckout = require('react-native-razorpay').default;
  return RazorpayCheckout.open({
    key: params.keyId,
    order_id: params.razorpayOrderId,
    amount: params.amountPaise,
    currency: params.currency,
    name: params.name,
    description: params.description,
    prefill: params.prefillPhone ? { contact: params.prefillPhone } : undefined,
  });
}

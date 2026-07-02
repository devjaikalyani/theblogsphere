import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export type BillingProvider = 'razorpay' | 'stripe';

export interface RazorpayOrder {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  days: number;
}

export interface PlanStatus {
  plan: string;
  pro: boolean;
  renewsAt: string | null;
  provider: BillingProvider | 'razorpay_onetime' | null;
  billingEnabled: boolean;
  stripeEnabled: boolean;
  razorpayEnabled: boolean;
  razorpayMode: 'subscription' | 'checkout' | null;
  ai: {
    used: number;
    limit: number | null;
    remaining: number | null;
    resetsAt: string | null;
  };
  narration: {
    limit: number | null;
    remaining: number | null;
  };
}

@Injectable({ providedIn: 'root' })
export class BillingService {
  constructor(private http: HttpClient) {}

  /** Current plan + AI quota for the signed-in user. */
  status(): Observable<PlanStatus> {
    return this.http.get<PlanStatus>('/api/billing/status', { withCredentials: true });
  }

  /** Start a Writer Pro subscription with the chosen gateway; returns a redirect
   *  URL (Stripe Checkout / Razorpay hosted auth page). */
  checkout(provider: BillingProvider): Observable<{ url: string }> {
    return this.http.post<{ url: string }>('/api/billing/checkout', { provider }, { withCredentials: true });
  }

  /** Manage the subscription. Stripe -> { url } (billing portal); Razorpay ->
   *  { cancelled: true } (cancels at cycle end). */
  manage(): Observable<{ url?: string; cancelled?: boolean }> {
    return this.http.post<{ url?: string; cancelled?: boolean }>('/api/billing/manage', {}, { withCredentials: true });
  }

  /** Razorpay Standard Checkout (keys-only mode): create a one-time Pro order
   *  for the Checkout modal to collect. */
  createOrder(): Observable<RazorpayOrder> {
    return this.http.post<RazorpayOrder>('/api/billing/razorpay/order', {}, { withCredentials: true });
  }

  /** Hand the modal's payment result to the server for signature verification;
   *  Pro is granted synchronously on success. */
  verifyPayment(payload: { orderId: string; paymentId: string; signature: string }): Observable<{ ok: boolean; proUntil?: string }> {
    return this.http.post<{ ok: boolean; proUntil?: string }>('/api/billing/razorpay/verify', payload, { withCredentials: true });
  }
}

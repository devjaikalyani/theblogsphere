import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export type BillingProvider = 'razorpay' | 'stripe';
/** The two paid tiers. Writer is the entry tier (unlimited AI + premium
 *  analytics + a light narration budget); Pro adds the full narration budget. */
export type PaidTier = 'writer' | 'pro';

export interface RazorpayOrder {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  days?: number;       // plan one-time window (absent for top-ups)
  tier?: PaidTier;     // which plan the order buys (absent for top-ups)
  chars?: number;      // top-up characters (absent for a plan)
  narrations?: number; // approx narrations in a top-up (absent for a plan)
}

/** Public gateway config (no user data), for rendering pricing to anyone. */
export interface BillingConfig {
  billingEnabled: boolean;
  razorpayEnabled: boolean;
  razorpayMode: 'subscription' | 'checkout' | null;
  stripeEnabled: boolean;
  razorpayInternational: boolean;
}

export interface PlanStatus {
  plan: string;   // 'free' | 'writer' | 'pro'
  paid: boolean;  // on any paid tier (Writer or Pro)
  pro: boolean;   // on the top tier only
  renewsAt: string | null;
  provider: BillingProvider | 'razorpay_onetime' | null;
  billingEnabled: boolean;
  stripeEnabled: boolean;
  razorpayEnabled: boolean;
  razorpayMode: 'subscription' | 'checkout' | null;
  razorpayInternational: boolean;
  ai: {
    used: number;
    limit: number | null;
    remaining: number | null;
    resetsAt: string | null;
  };
  narration: {
    pro: boolean;
    limitChars: number;     // budget size (monthly for Pro, lifetime for free)
    usedChars: number;
    creditChars: number;    // prepaid top-up characters (Pro)
    remainingChars: number;
    remaining: number;      // approx narrations left
    resetsAt: string | null; // Pro monthly reset; null for free
  };
}

@Injectable({ providedIn: 'root' })
export class BillingService {
  constructor(private http: HttpClient) {}

  /** Current plan + AI quota for the signed-in user. */
  status(): Observable<PlanStatus> {
    return this.http.get<PlanStatus>('/api/billing/status', { withCredentials: true });
  }

  /** Public gateway config (works signed out) so the pricing page can show the
   *  right buttons and billing terms to everyone. */
  config(): Observable<BillingConfig> {
    return this.http.get<BillingConfig>('/api/billing/config', { withCredentials: true });
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

  /** Razorpay Standard Checkout (keys-only mode): create a one-time plan order
   *  for the Checkout modal to collect. INR for India (UPI/cards); USD for
   *  international cards where the account has International enabled.
   *  tier 'writer' buys the entry plan, 'pro' the full one. term 'annual' buys a
   *  365-day pass; 'monthly' (default) a 30-day one. */
  createOrder(
    tier: PaidTier = 'pro',
    currency: 'INR' | 'USD' = 'INR',
    term: 'monthly' | 'annual' = 'monthly',
  ): Observable<RazorpayOrder> {
    return this.http.post<RazorpayOrder>('/api/billing/razorpay/order', { tier, currency, term }, { withCredentials: true });
  }

  /** Prepaid narration top-up pack (Pro only): one-time order for the same
   *  Checkout modal. Adds narration characters on successful verify. */
  createTopupOrder(currency: 'INR' | 'USD' = 'INR'): Observable<RazorpayOrder> {
    return this.http.post<RazorpayOrder>('/api/billing/razorpay/topup', { currency }, { withCredentials: true });
  }

  /** Hand the modal's payment result to the server for signature verification.
   *  Pro (or top-up credits) are applied synchronously on success. */
  verifyPayment(payload: { orderId: string; paymentId: string; signature: string }): Observable<{ ok: boolean; plan?: PaidTier; proUntil?: string; topup?: boolean; addedNarrations?: number }> {
    return this.http.post<{ ok: boolean; plan?: PaidTier; proUntil?: string; topup?: boolean; addedNarrations?: number }>('/api/billing/razorpay/verify', payload, { withCredentials: true });
  }
}

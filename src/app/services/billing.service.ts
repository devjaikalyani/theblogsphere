import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export type BillingProvider = 'razorpay' | 'stripe';

export interface PlanStatus {
  plan: string;
  pro: boolean;
  renewsAt: string | null;
  provider: BillingProvider | null;
  billingEnabled: boolean;
  stripeEnabled: boolean;
  razorpayEnabled: boolean;
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
}

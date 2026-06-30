import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface PlanStatus {
  plan: string;
  pro: boolean;
  renewsAt: string | null;
  billingEnabled: boolean;
  ai: {
    used: number;
    limit: number | null;
    remaining: number | null;
    resetsAt: string | null;
  };
}

@Injectable({ providedIn: 'root' })
export class BillingService {
  constructor(private http: HttpClient) {}

  /** Current plan + AI quota for the signed-in user. */
  status(): Observable<PlanStatus> {
    return this.http.get<PlanStatus>('/api/billing/status', { withCredentials: true });
  }

  /** Start a Stripe Checkout session for Writer Pro; returns the redirect URL. */
  checkout(): Observable<{ url: string }> {
    return this.http.post<{ url: string }>('/api/billing/checkout', {}, { withCredentials: true });
  }

  /** Open the Stripe billing portal (manage / cancel); returns the redirect URL. */
  portal(): Observable<{ url: string }> {
    return this.http.post<{ url: string }>('/api/billing/portal', {}, { withCredentials: true });
  }
}

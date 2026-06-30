import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { BillingService, BillingProvider, PlanStatus } from '../../services/billing.service';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { SeoService } from '../../services/seo.service';

@Component({
  selector: 'app-pricing',
  imports: [RouterLink, DatePipe],
  templateUrl: './pricing.component.html',
})
export class PricingComponent implements OnInit {
  status = signal<PlanStatus | null>(null);
  loading = signal(false);

  constructor(
    private billing: BillingService,
    readonly auth: AuthService,
    private toast: ToastService,
    seo: SeoService,
  ) {
    seo.set({
      title: 'Pricing | TheBlogSphere',
      description: 'TheBlogSphere is free to read and write. Upgrade to Writer Pro for unlimited AI assistance, premium analytics, and a custom presence.',
      canonicalPath: '/pricing',
    });
  }

  ngOnInit() {
    if (this.auth.session()?.user) {
      this.billing.status().subscribe({ next: (s) => this.status.set(s), error: () => {} });
    }
  }

  get isPro(): boolean {
    return this.status()?.pro ?? false;
  }

  upgrade(provider: BillingProvider) {
    if (!this.auth.session()?.user) {
      this.toast.show('Sign in to upgrade to Pro.', 'info');
      return;
    }
    this.loading.set(true);
    this.billing.checkout(provider).subscribe({
      next: (r) => { if (r.url) window.location.href = r.url; else this.fail(); },
      error: (e) => this.fail(e),
    });
  }

  manage() {
    this.loading.set(true);
    this.billing.manage().subscribe({
      next: (r) => {
        if (r.url) { window.location.href = r.url; return; }
        this.loading.set(false);
        if (r.cancelled) {
          this.toast.show('Your plan will not renew. You keep Pro until the current period ends.', 'success');
          this.billing.status().subscribe({ next: (s) => this.status.set(s) });
        }
      },
      error: (e) => this.fail(e),
    });
  }

  private fail(e?: any) {
    this.loading.set(false);
    this.toast.show(e?.error?.message || 'Billing is not available yet. Please try again later.', 'error');
  }
}

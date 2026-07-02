import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { BillingService, BillingProvider, PlanStatus, RazorpayOrder } from '../../services/billing.service';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { SeoService } from '../../services/seo.service';

// checkout.js is loaded on first use (pricing page only), never during SSR —
// the promise is module-scoped so repeat purchases don't re-inject the tag.
let checkoutScript: Promise<void> | null = null;
function loadRazorpayScript(): Promise<void> {
  if ((window as any).Razorpay) return Promise.resolve();
  checkoutScript ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve();
    s.onerror = () => {
      checkoutScript = null;
      reject(new Error('Failed to load Razorpay Checkout.'));
    };
    document.body.appendChild(s);
  });
  return checkoutScript;
}

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
    // Keys-only Razorpay runs as a one-time Standard Checkout modal; with a
    // subscription plan configured it redirects to the hosted page instead.
    if (provider === 'razorpay' && this.status()?.razorpayMode === 'checkout') {
      this.loading.set(true);
      this.billing.createOrder().subscribe({
        next: (order) => this.openCheckout(order),
        error: (e) => this.fail(e),
      });
      return;
    }
    this.loading.set(true);
    this.billing.checkout(provider).subscribe({
      next: (r) => { if (r.url) window.location.href = r.url; else this.fail(); },
      error: (e) => this.fail(e),
    });
  }

  private async openCheckout(order: RazorpayOrder) {
    try {
      await loadRazorpayScript();
    } catch {
      return this.fail();
    }
    const user = this.auth.session()?.user;
    const rzp = new (window as any).Razorpay({
      key: order.keyId,
      order_id: order.orderId,
      amount: order.amount,
      currency: order.currency,
      name: 'TheBlogSphere',
      description: `Writer Pro — ${order.days} days`,
      prefill: { name: user?.name ?? '', email: user?.email ?? '' },
      theme: { color: '#1A1714' },
      handler: (res: any) => this.verifyPayment(res),
      modal: { ondismiss: () => this.loading.set(false) },
    });
    rzp.on('payment.failed', (res: any) => {
      this.loading.set(false);
      this.toast.show(res?.error?.description || 'Payment failed. Please try again.', 'error');
    });
    rzp.open();
  }

  private verifyPayment(res: any) {
    this.billing.verifyPayment({
      orderId: res.razorpay_order_id,
      paymentId: res.razorpay_payment_id,
      signature: res.razorpay_signature,
    }).subscribe({
      next: () => {
        this.loading.set(false);
        this.toast.show('Welcome to Writer Pro. Unlimited AI and narration are now unlocked.', 'success');
        this.billing.status().subscribe({ next: (s) => this.status.set(s) });
      },
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

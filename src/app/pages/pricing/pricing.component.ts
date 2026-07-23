import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { BillingService, BillingProvider, BillingConfig, PlanStatus, RazorpayOrder, PaidTier } from '../../services/billing.service';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { SeoService } from '../../services/seo.service';

// checkout.js is loaded on first use (pricing page only), never during SSR,
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
  config = signal<BillingConfig | null>(null);
  loading = signal(false);

  constructor(
    private billing: BillingService,
    readonly auth: AuthService,
    private toast: ToastService,
    seo: SeoService,
  ) {
    seo.set({
      title: 'Pricing | TheBlogSphere',
      description: 'Free to read, write, and get paid over UPI with no platform cut. Upgrade to Writer (₹149/mo) or Pro (₹399/mo) for more narration, premium analytics, and unlimited AI.',
      canonicalPath: '/pricing',
    });
  }

  ngOnInit() {
    // Config is public, so load it for everyone (drives buttons + billing terms).
    this.billing.config().subscribe({ next: (c) => this.config.set(c), error: () => {} });
    if (this.auth.session()?.user) {
      this.billing.status().subscribe({ next: (s) => this.status.set(s), error: () => {} });
    }
  }

  get isPaid(): boolean {
    return this.status()?.paid ?? false;
  }
  get isPro(): boolean {
    return this.status()?.pro ?? false;
  }
  /** 'free' | 'writer' | 'pro' — the effective tier for the signed-in user. */
  get tier(): string {
    return this.status()?.plan ?? 'free';
  }
  /** True when the active paid plan is a one-time pass (extendable, not cancel). */
  get oneTime(): boolean {
    return this.status()?.provider === 'razorpay_onetime';
  }
  /** True when Pro should be sold as an auto-renewing subscription (a Razorpay
   *  subscription plan or Stripe is configured) rather than a one-time pass. */
  get proSubMode(): boolean {
    return this.config()?.razorpayMode === 'subscription' || (this.config()?.stripeEnabled ?? false);
  }
  private label(tier: PaidTier): string {
    return tier === 'pro' ? 'Writer Pro' : 'Writer';
  }

  /** Buy a plan tier in INR through the one-time Checkout modal. Both Writer
   *  and Pro sell this way; Pro can also run as an auto-renewing subscription
   *  (see subscribePro) when the gateway is configured for it. */
  buy(tier: PaidTier, term: 'monthly' | 'annual') {
    if (!this.requireAuth()) return;
    this.payWithModal(tier, 'INR', term);
  }

  /** Pro via the configured subscription gateway (Razorpay hosted page or
   *  Stripe). Only used when razorpayMode === 'subscription' / Stripe is on;
   *  Writer never subscribes. */
  subscribePro(provider: BillingProvider) {
    if (!this.requireAuth()) return;
    this.loading.set(true);
    this.billing.checkout(provider).subscribe({
      next: (r) => { if (r.url) window.location.href = r.url; else this.fail(); },
      error: (e) => this.fail(e),
    });
  }

  /** International card path for a tier: Stripe (Pro subscription) when
   *  configured, otherwise the Razorpay USD modal (one-time, needs
   *  International approved on the account). */
  buyInternational(tier: PaidTier, term: 'monthly' | 'annual') {
    if (!this.requireAuth()) return;
    if (tier === 'pro' && this.config()?.stripeEnabled) {
      this.subscribePro('stripe');
      return;
    }
    if (this.config()?.razorpayInternational) {
      this.payWithModal(tier, 'USD', term);
      return;
    }
    this.toast.show('International payments are not available yet. Please try the INR option.', 'info');
  }

  private requireAuth(): boolean {
    if (!this.auth.session()?.user) {
      this.toast.show('Sign in to upgrade.', 'info');
      return false;
    }
    return true;
  }

  private payWithModal(tier: PaidTier, currency: 'INR' | 'USD', term: 'monthly' | 'annual') {
    this.loading.set(true);
    this.billing.createOrder(tier, currency, term).subscribe({
      next: (order) => this.openCheckout(order, `${this.label(tier)}, ${order.days} days`),
      error: (e) => this.fail(e),
    });
  }

  /** Buy a prepaid narration top-up pack (Pro only). */
  buyTopup() {
    if (!this.auth.session()?.user) {
      this.toast.show('Sign in to buy a top-up.', 'info');
      return;
    }
    this.loading.set(true);
    this.billing.createTopupOrder('INR').subscribe({
      next: (order) => this.openCheckout(order, `Narration top-up, ${order.narrations} narrations`),
      error: (e) => this.fail(e),
    });
  }

  private async openCheckout(order: RazorpayOrder, description: string) {
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
      description,
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
    const wasPaid = this.isPaid; // pre-purchase state, for the right message below
    this.billing.verifyPayment({
      orderId: res.razorpay_order_id,
      paymentId: res.razorpay_payment_id,
      signature: res.razorpay_signature,
    }).subscribe({
      next: (r) => {
        this.loading.set(false);
        const name = r?.plan === 'pro' ? 'Writer Pro' : 'Writer';
        if (r?.topup) {
          this.toast.show(`Top-up added. About ${r.addedNarrations ?? ''} more narrations this month.`, 'success');
        } else if (wasPaid && r?.proUntil) {
          const until = new Date(r.proUntil).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
          this.toast.show(`${name} active. Your access now runs until ${until}.`, 'success');
        } else {
          this.toast.show(`Welcome to ${name}. Unlimited AI and your monthly narration budget are now unlocked.`, 'success');
        }
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

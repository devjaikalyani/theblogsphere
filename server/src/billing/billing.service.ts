import { Injectable, Inject, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import Stripe from 'stripe';
import Razorpay from 'razorpay';
import { PrismaService } from '../prisma/prisma.service';

/** Free writers get this many AI actions per rolling 30-day window. Pro is
 *  unlimited. Tuned to be generous enough for a hobby writer but to make a
 *  serious one feel the ceiling. */
export const FREE_AI_MONTHLY_LIMIT = 25;
/** Free readers get this many human-quality (neural) narrations, lifetime —
 *  a taste of the premium feature before the Pro paywall. Pro is unlimited. */
export const FREE_NARRATION_LIMIT = 5;
const PERIOD_MS = 30 * 24 * 60 * 60 * 1000;
/** One-time Standard Checkout price (₹199 in paise) and the Pro window it
 *  buys. Used when only the Razorpay API keys are configured (no subscription
 *  plan/webhook) — the modal flow verifies synchronously by signature. */
const PRO_ONE_TIME_PAISE = 19900;
const PRO_ONE_TIME_DAYS = 30;

@Injectable()
export class BillingService {
  private stripe: Stripe | null = null;
  private razorpay: Razorpay | null = null;

  constructor(@Inject(PrismaService) private prisma: PrismaService) {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (stripeKey) this.stripe = new Stripe(stripeKey);

    const rzpId = process.env.RAZORPAY_KEY_ID;
    const rzpSecret = process.env.RAZORPAY_KEY_SECRET;
    if (rzpId && rzpSecret) this.razorpay = new Razorpay({ key_id: rzpId, key_secret: rzpSecret });
  }

  /** Billing only works once a gateway is configured; until then the rest of
   *  the app (free tier + AI metering) runs normally and upgrade calls 400.
   *  Razorpay serves India (INR/UPI), Stripe serves international (USD). */
  get enabled(): boolean {
    return !!this.stripe || !!this.razorpay;
  }
  get stripeEnabled(): boolean { return !!this.stripe; }
  get razorpayEnabled(): boolean { return !!this.razorpay; }
  /** 'subscription' when a plan id is configured (hosted page + webhook),
   *  'checkout' when only API keys are (one-time modal), null when disabled. */
  get razorpayMode(): 'subscription' | 'checkout' | null {
    if (!this.razorpay) return null;
    return process.env.RAZORPAY_PLAN_PRO ? 'subscription' : 'checkout';
  }

  isPro(plan?: string | null): boolean {
    return plan === 'pro';
  }

  /** A one-time purchase has no webhook to end it, so its expiry is applied
   *  lazily on the next billing-aware read. Subscriptions are untouched — their
   *  planRenewsAt routinely passes while the gateway confirms renewal. */
  private oneTimeExpired(u: { plan: string | null; billingProvider: string | null; planRenewsAt: Date | null }): boolean {
    return (
      u.plan === 'pro' &&
      u.billingProvider === 'razorpay_onetime' &&
      !!u.planRenewsAt &&
      new Date(u.planRenewsAt).getTime() < Date.now()
    );
  }

  /** The user's effective plan, downgrading an expired one-time purchase. */
  async currentPlan(userId: string): Promise<'free' | 'pro'> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true, billingProvider: true, planRenewsAt: true },
    });
    if (!user) return 'free';
    if (this.oneTimeExpired(user)) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { plan: 'free', planRenewsAt: null },
      });
      return 'free';
    }
    return this.isPro(user.plan) ? 'pro' : 'free';
  }

  /** Plan + AI-quota snapshot for the settings / pricing / assistant screens. */
  async getStatus(userId: string) {
    let user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true, planRenewsAt: true, billingProvider: true, aiUsageCount: true, aiUsagePeriodStart: true, narrationCount: true },
    });
    if (user && this.oneTimeExpired(user)) {
      await this.prisma.user.update({ where: { id: userId }, data: { plan: 'free', planRenewsAt: null } });
      user = { ...user, plan: 'free', planRenewsAt: null };
    }
    const pro = this.isPro(user?.plan);
    const expired = this.periodExpired(user?.aiUsagePeriodStart ?? null);
    const used = expired ? 0 : user?.aiUsageCount ?? 0;
    const resetsAt = this.periodEnd(user?.aiUsagePeriodStart ?? null, expired);
    const narrationsUsed = user?.narrationCount ?? 0;

    return {
      plan: user?.plan ?? 'free',
      pro,
      renewsAt: user?.planRenewsAt ?? null,
      provider: user?.billingProvider ?? null,
      billingEnabled: this.enabled,
      stripeEnabled: this.stripeEnabled,
      razorpayEnabled: this.razorpayEnabled,
      razorpayMode: this.razorpayMode,
      ai: {
        used: pro ? 0 : used,
        limit: pro ? null : FREE_AI_MONTHLY_LIMIT,
        remaining: pro ? null : Math.max(0, FREE_AI_MONTHLY_LIMIT - used),
        resetsAt: pro ? null : resetsAt,
      },
      narration: {
        limit: pro ? null : FREE_NARRATION_LIMIT,
        remaining: pro ? null : Math.max(0, FREE_NARRATION_LIMIT - narrationsUsed),
      },
    };
  }

  /** Gate a neural narration BEFORE spending provider credits: Pro is
   *  unlimited, free readers get FREE_NARRATION_LIMIT lifetime. Throws 402 when
   *  exhausted so the client can surface the upgrade prompt. Returns the
   *  pre-use remaining count (null for Pro). */
  async assertNarrationAllowed(userId: string): Promise<{ pro: boolean; remaining: number | null }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true, narrationCount: true },
    });
    if (!user) throw new HttpException({ error: 'unauthorized' }, HttpStatus.UNAUTHORIZED);
    if (this.isPro(user.plan) && (await this.currentPlan(userId)) === 'pro') return { pro: true, remaining: null };
    if (user.narrationCount >= FREE_NARRATION_LIMIT) {
      throw new HttpException(
        {
          error: 'narration_quota_exceeded',
          message: `You've used all ${FREE_NARRATION_LIMIT} free narrations. Upgrade to Pro for unlimited human-quality read-aloud.`,
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }
    return { pro: false, remaining: FREE_NARRATION_LIMIT - user.narrationCount };
  }

  /** Bill one narration against the free tier — only after the audio was
   *  actually delivered. Pro users are never charged. */
  async recordNarration(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { plan: true } });
    if (!user || this.isPro(user.plan)) return;
    await this.prisma.user.update({ where: { id: userId }, data: { narrationCount: { increment: 1 } } });
  }

  /** Spend one AI credit. Pro is unlimited; free users draw from a rolling
   *  30-day quota that resets lazily. Throws 429 when exhausted so the client
   *  can surface an upgrade prompt. */
  async consumeAiCredit(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true, aiUsageCount: true, aiUsagePeriodStart: true },
    });
    if (!user) return; // unknown user: no limit to apply
    if (this.isPro(user.plan) && (await this.currentPlan(userId)) === 'pro') return; // Pro: unlimited

    const expired = this.periodExpired(user.aiUsagePeriodStart);
    const used = expired ? 0 : user.aiUsageCount;

    if (used >= FREE_AI_MONTHLY_LIMIT) {
      throw new HttpException(
        {
          error: 'ai_quota_exceeded',
          message: `You've used all ${FREE_AI_MONTHLY_LIMIT} free AI actions this month. Upgrade to Pro for unlimited assistance.`,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: expired
        ? { aiUsageCount: 1, aiUsagePeriodStart: new Date() }
        : { aiUsageCount: { increment: 1 } },
    });
  }

  private periodExpired(start: Date | null): boolean {
    return !start || Date.now() - new Date(start).getTime() >= PERIOD_MS;
  }

  private periodEnd(start: Date | null, expired: boolean): Date {
    const base = expired || !start ? Date.now() : new Date(start).getTime();
    return new Date(base + PERIOD_MS);
  }

  // ── Stripe checkout / portal ────────────────────────────────────────────
  async createCheckoutSession(userId: string, email: string) {
    if (!this.stripe) throw new BadRequestException('Billing is not configured yet.');
    const priceId = process.env.STRIPE_PRICE_PRO;
    if (!priceId) throw new BadRequestException('STRIPE_PRICE_PRO is not set.');

    const customerId = await this.ensureCustomer(userId, email);
    const appUrl = this.appUrl();
    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/settings?upgrade=success`,
      cancel_url: `${appUrl}/pricing?upgrade=cancelled`,
      allow_promotion_codes: true,
      client_reference_id: userId,
      metadata: { userId },
    });
    return { url: session.url };
  }

  async createPortalSession(userId: string) {
    if (!this.stripe) throw new BadRequestException('Billing is not configured yet.');
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true },
    });
    if (!user?.stripeCustomerId) throw new BadRequestException('No billing account yet.');
    const session = await this.stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${this.appUrl()}/settings`,
    });
    return { url: session.url };
  }

  private async ensureCustomer(userId: string, email: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true },
    });
    if (user?.stripeCustomerId) return user.stripeCustomerId;
    const customer = await this.stripe!.customers.create({ email, metadata: { userId } });
    await this.prisma.user.update({ where: { id: userId }, data: { stripeCustomerId: customer.id } });
    return customer.id;
  }

  private appUrl(): string {
    return (
      process.env.APP_URL ||
      process.env.ALLOWED_ORIGINS?.split(',')[0] ||
      'http://localhost:4200'
    ).trim();
  }

  /** Idempotency ledger: true the first time this id is seen, false on a
   *  replay (gateway webhook retries, double-submitted verifies). Ids without
   *  a value can't be deduped and are processed normally. */
  private async firstTime(id: string | null | undefined, provider: string, kind: string): Promise<boolean> {
    if (!id) return true;
    try {
      await this.prisma.billingEvent.create({ data: { id, provider, kind } });
      return true;
    } catch (e: any) {
      if (e?.code === 'P2002') return false;
      throw e;
    }
  }

  // ── Stripe webhook ──────────────────────────────────────────────────────
  /** Verify the signature and reconcile user.plan with the subscription state. */
  async handleWebhook(rawBody: Buffer, signature: string) {
    if (!this.stripe) throw new BadRequestException('Billing is not configured yet.');
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) throw new BadRequestException('STRIPE_WEBHOOK_SECRET is not set.');

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, secret);
    } catch (e: any) {
      throw new BadRequestException(`Webhook signature verification failed: ${e?.message}`);
    }

    if (!(await this.firstTime(event.id, 'stripe', 'webhook'))) return { received: true };

    switch (event.type) {
      case 'checkout.session.completed':
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = await this.subscriptionFromEvent(event);
        if (sub) await this.applySubscription(sub);
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        await this.downgradeByCustomer(sub.customer as string);
        break;
      }
    }
    return { received: true };
  }

  private async subscriptionFromEvent(event: Stripe.Event): Promise<Stripe.Subscription | null> {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      if (!session.subscription) return null;
      return this.stripe!.subscriptions.retrieve(session.subscription as string);
    }
    return event.data.object as Stripe.Subscription;
  }

  private async applySubscription(sub: Stripe.Subscription) {
    const active = sub.status === 'active' || sub.status === 'trialing';
    const periodEnd = (sub as any).current_period_end as number | undefined;
    await this.prisma.user.updateMany({
      where: { stripeCustomerId: sub.customer as string },
      data: {
        plan: active ? 'pro' : 'free',
        billingProvider: active ? 'stripe' : undefined,
        stripeSubscriptionId: sub.id,
        planRenewsAt: active && periodEnd ? new Date(periodEnd * 1000) : null,
      },
    });
  }

  // ── Razorpay (India — INR / UPI) ────────────────────────────────────────
  /** Create a Razorpay subscription and return its hosted auth/checkout URL
   *  (short_url) for the client to redirect to — mirrors the Stripe flow. */
  async createRazorpaySubscription(userId: string, email: string) {
    if (!this.razorpay) throw new BadRequestException('Razorpay is not configured yet.');
    const planId = process.env.RAZORPAY_PLAN_PRO;
    if (!planId) throw new BadRequestException('RAZORPAY_PLAN_PRO is not set.');

    const sub: any = await this.razorpay.subscriptions.create({
      plan_id: planId,
      total_count: 120,
      customer_notify: 1,
      notify_info: { notify_email: email },
      notes: { userId },
    } as any);

    await this.prisma.user.update({
      where: { id: userId },
      data: { razorpaySubscriptionId: sub.id, billingProvider: 'razorpay' },
    });
    return { url: sub.short_url as string };
  }

  // ── Razorpay Standard Checkout (one-time, keys-only mode) ──────────────
  /** Create an order for one Pro window. The client opens the Checkout modal
   *  with this order id; keyId is the publishable half of the key pair. */
  async createRazorpayOrder(userId: string) {
    if (!this.razorpay) throw new BadRequestException('Razorpay is not configured yet.');
    const order: any = await this.razorpay.orders.create({
      amount: PRO_ONE_TIME_PAISE,
      currency: 'INR',
      receipt: `pro-${Date.now().toString(36)}`,
      notes: { userId, purpose: `writer-pro-${PRO_ONE_TIME_DAYS}d` },
    });
    return {
      orderId: order.id as string,
      amount: order.amount as number,
      currency: order.currency as string,
      keyId: process.env.RAZORPAY_KEY_ID!,
      days: PRO_ONE_TIME_DAYS,
    };
  }

  /** Verify a Checkout payment and grant Pro. The signature —
   *  HMAC-SHA256(order_id|payment_id, key secret) — only Razorpay can produce;
   *  the order fetch then binds it to this user at the Pro price, and the
   *  BillingEvent ledger makes replays a no-op instead of a free extension. */
  async verifyRazorpayPayment(
    userId: string,
    dto: { orderId?: string; paymentId?: string; signature?: string },
  ) {
    if (!this.razorpay) throw new BadRequestException('Razorpay is not configured yet.');
    const { orderId, paymentId, signature } = dto;
    if (!orderId || !paymentId || !signature) {
      throw new BadRequestException('orderId, paymentId and signature are required.');
    }

    const expected = createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(`${orderId}|${paymentId}`)
      .digest();
    const given = Buffer.from(signature, 'hex');
    if (given.length !== expected.length || !timingSafeEqual(expected, given)) {
      throw new BadRequestException('Payment signature verification failed.');
    }

    const order: any = await this.razorpay.orders.fetch(orderId);
    if (order?.notes?.userId !== userId) {
      throw new BadRequestException('This payment belongs to a different account.');
    }
    if (Number(order?.amount) !== PRO_ONE_TIME_PAISE) {
      throw new BadRequestException('Unexpected order amount.');
    }

    if (!(await this.firstTime(paymentId, 'razorpay', 'payment'))) {
      return { ok: true, alreadyProcessed: true }; // replayed verify — no free extension
    }

    const proUntil = new Date(Date.now() + PRO_ONE_TIME_DAYS * 24 * 60 * 60 * 1000);
    await this.prisma.user.update({
      where: { id: userId },
      data: { plan: 'pro', billingProvider: 'razorpay_onetime', planRenewsAt: proUntil },
    });
    return { ok: true, plan: 'pro', proUntil };
  }

  /** Cancel the user's subscription. Stripe users get the billing portal;
   *  Razorpay users are cancelled at cycle end (they keep Pro until then). */
  async manageOrCancel(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { billingProvider: true, stripeCustomerId: true, razorpaySubscriptionId: true },
    });
    if (!user) throw new BadRequestException('No account.');

    if (user.billingProvider === 'razorpay_onetime') {
      throw new BadRequestException(
        'Writer Pro was a one-time purchase — there is nothing to cancel. Pro simply ends on the expiry date.',
      );
    }
    if (user.billingProvider === 'razorpay') {
      if (!this.razorpay || !user.razorpaySubscriptionId) throw new BadRequestException('No active subscription.');
      await this.razorpay.subscriptions.cancel(user.razorpaySubscriptionId, true); // at cycle end
      return { cancelled: true, atCycleEnd: true };
    }
    // Stripe (default): hand off to the hosted billing portal.
    return this.createPortalSession(userId);
  }

  /** Verify (HMAC-SHA256) + apply a Razorpay webhook. */
  async handleRazorpayWebhook(rawBody: Buffer, signature: string, eventId?: string) {
    if (!this.razorpay) throw new BadRequestException('Razorpay is not configured yet.');
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) throw new BadRequestException('RAZORPAY_WEBHOOK_SECRET is not set.');

    const expected = createHmac('sha256', secret).update(rawBody).digest();
    const given = Buffer.from(signature ?? '', 'hex');
    if (given.length !== expected.length || !timingSafeEqual(expected, given)) {
      throw new BadRequestException('Invalid Razorpay webhook signature.');
    }

    if (!(await this.firstTime(eventId, 'razorpay', 'webhook'))) return { received: true };

    const event = JSON.parse(rawBody.toString());
    const sub = event?.payload?.subscription?.entity;
    if (!sub?.id) return { received: true };

    const active = sub.status === 'active' || sub.status === 'authenticated';
    const ended = ['cancelled', 'completed', 'halted', 'expired'].includes(sub.status);
    const renews = sub.current_end ? new Date(sub.current_end * 1000) : null;
    const userId = sub.notes?.userId as string | undefined;

    if (active) {
      const res = await this.prisma.user.updateMany({
        where: { razorpaySubscriptionId: sub.id },
        data: { plan: 'pro', billingProvider: 'razorpay', planRenewsAt: renews },
      });
      // Fallback if the subscription id wasn't persisted (race on first auth).
      if (res.count === 0 && userId) {
        await this.prisma.user.update({
          where: { id: userId },
          data: { plan: 'pro', billingProvider: 'razorpay', razorpaySubscriptionId: sub.id, planRenewsAt: renews },
        });
      }
    } else if (ended) {
      await this.prisma.user.updateMany({
        where: { razorpaySubscriptionId: sub.id },
        data: { plan: 'free', planRenewsAt: null },
      });
    }
    return { received: true };
  }

  private async downgradeByCustomer(customerId: string) {
    await this.prisma.user.updateMany({
      where: { stripeCustomerId: customerId },
      data: { plan: 'free', planRenewsAt: null, stripeSubscriptionId: null },
    });
  }
}

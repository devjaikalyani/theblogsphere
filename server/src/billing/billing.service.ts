import { Injectable, Inject, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import Stripe from 'stripe';
import Razorpay from 'razorpay';
import { PrismaService } from '../prisma/prisma.service';

/** Free writers get this many AI actions per rolling 30-day window. Tuned to be
 *  generous enough for a hobby writer but to make a serious one feel the ceiling. */
export const FREE_AI_MONTHLY_LIMIT = 25;
/** Pro is "unlimited" for any human, but a scripted account could otherwise run
 *  up Groq costs without bound. This is a silent fair-use backstop, far above
 *  what a real writer hits, so it only ever bites abuse. Not shown in the UI. */
export const PRO_AI_MONTHLY_LIMIT = 500;
/** Narration is metered by characters, exactly what OpenAI bills ($15 / 1M on
 *  tts-1), so the cost ceiling holds no matter how long an article is. A
 *  cache hit (re-listening to an already-narrated story) is free for everyone
 *  and never counted; only generating NEW audio draws these budgets down.
 *
 *  Free: a lifetime taste (~7 average articles). Worst case ~₹60 one-time.
 *  Pro:  a monthly budget (~20 average articles), then prepaid top-up packs.
 *        Worst case ~₹175/mo against ₹399 revenue → the margin is guaranteed. */
export const FREE_NARRATION_CHARS = 45_000;
export const PRO_NARRATION_CHARS = 130_000;
/** Characters added by one prepaid narration top-up pack (~15 articles). */
export const NARRATION_TOPUP_CHARS = 100_000;
/** Only for display: turns a character budget into a friendly "~N narrations"
 *  count. An "average" narration is ~1000 words ≈ 6,400 characters. */
const AVG_NARRATION_CHARS = 6_400;
const PERIOD_MS = 30 * 24 * 60 * 60 * 1000;
/** One-time Standard Checkout prices (smallest currency unit) and the Pro
 *  window they buy. Used when only the Razorpay API keys are configured (no
 *  subscription plan/webhook); the modal flow verifies synchronously by
 *  signature. USD (international cards) additionally needs International
 *  payments approved on the Razorpay account + RAZORPAY_INTERNATIONAL=true. */
const PRO_ONE_TIME_PRICES: Record<string, number> = {
  INR: 39900, // ₹399, matches the pricing page
  USD: 799, // $7.99, the pricing page's international price
};
const PRO_ONE_TIME_DAYS = 30;
/** Annual pass: about 7.5 monthly cycles for 12 months of Pro. Upfront cash
 *  and no renewal friction; rides the exact same one-time Checkout + lazy
 *  expiry path as the 30-day window, just with a longer term. */
const PRO_ANNUAL_PRICES: Record<string, number> = {
  INR: 299900, // ₹2,999 (about 37% off twelve months of ₹399)
  USD: 5999, // $59.99
};
const PRO_ANNUAL_DAYS = 365;
export type ProTerm = 'monthly' | 'annual';
/** Prepaid narration top-up pack prices (smallest currency unit), cut through
 *  the same Standard Checkout + verify flow as Pro (distinguished by the
 *  order's notes.purpose). Cost of the characters is ~₹135, so both prices
 *  clear a healthy margin. */
const NARRATION_TOPUP_PRICES: Record<string, number> = {
  INR: 19900, // ₹199
  USD: 399, // $3.99
};

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
  /** USD checkout for international cards. Opt-in flag because it only works
   *  once Razorpay has approved International payments on the account;
   *  until then the button would render and every payment would decline. */
  get razorpayInternational(): boolean {
    return this.razorpayEnabled && process.env.RAZORPAY_INTERNATIONAL === 'true';
  }

  isPro(plan?: string | null): boolean {
    return plan === 'pro';
  }

  /** A one-time purchase has no webhook to end it, so its expiry is applied
   *  lazily on the next billing-aware read. Subscriptions are untouched; their
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

  /** Public billing config (no user data): which gateways are on and whether
   *  Razorpay runs one-time checkout or auto-renewing subscriptions. Drives the
   *  pricing page's buttons and billing terms for signed-out visitors too. */
  publicConfig() {
    return {
      billingEnabled: this.enabled,
      razorpayEnabled: this.razorpayEnabled,
      razorpayMode: this.razorpayMode,
      stripeEnabled: this.stripeEnabled,
      razorpayInternational: this.razorpayInternational,
    };
  }

  /** Plan + AI-quota snapshot for the settings / pricing / assistant screens. */
  async getStatus(userId: string) {
    let user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        plan: true, planRenewsAt: true, billingProvider: true, aiUsageCount: true, aiUsagePeriodStart: true,
        narrationCharsUsed: true, narrationPeriodStart: true, narrationCreditChars: true,
      },
    });
    if (user && this.oneTimeExpired(user)) {
      await this.prisma.user.update({ where: { id: userId }, data: { plan: 'free', planRenewsAt: null } });
      user = { ...user, plan: 'free', planRenewsAt: null };
    }
    const pro = this.isPro(user?.plan);
    const expired = this.periodExpired(user?.aiUsagePeriodStart ?? null);
    const used = expired ? 0 : user?.aiUsageCount ?? 0;
    const resetsAt = this.periodEnd(user?.aiUsagePeriodStart ?? null, expired);
    const narration = this.narrationSnapshot(user ?? null, pro);

    return {
      plan: user?.plan ?? 'free',
      pro,
      renewsAt: user?.planRenewsAt ?? null,
      provider: user?.billingProvider ?? null,
      billingEnabled: this.enabled,
      stripeEnabled: this.stripeEnabled,
      razorpayEnabled: this.razorpayEnabled,
      razorpayMode: this.razorpayMode,
      razorpayInternational: this.razorpayInternational,
      ai: {
        used: pro ? 0 : used,
        limit: pro ? null : FREE_AI_MONTHLY_LIMIT,
        remaining: pro ? null : Math.max(0, FREE_AI_MONTHLY_LIMIT - used),
        resetsAt: pro ? null : resetsAt,
      },
      narration,
    };
  }

  /** Narration budget snapshot for the settings / pricing screens: character
   *  figures (the true cost meter) plus a friendly "~N narrations" estimate. */
  private narrationSnapshot(
    u: { narrationCharsUsed: number; narrationPeriodStart: Date | null; narrationCreditChars: number } | null,
    pro: boolean,
  ) {
    const charsUsed = u?.narrationCharsUsed ?? 0;
    const credits = Math.max(0, u?.narrationCreditChars ?? 0);
    if (pro) {
      const nExpired = this.periodExpired(u?.narrationPeriodStart ?? null);
      const usedThisPeriod = nExpired ? 0 : charsUsed;
      const periodRemaining = Math.max(0, PRO_NARRATION_CHARS - usedThisPeriod);
      const remainingChars = periodRemaining + credits;
      return {
        pro: true,
        limitChars: PRO_NARRATION_CHARS,
        usedChars: usedThisPeriod,
        creditChars: credits,
        remainingChars,
        remaining: this.approxNarrations(remainingChars),
        resetsAt: this.periodEnd(u?.narrationPeriodStart ?? null, nExpired),
      };
    }
    const remainingChars = Math.max(0, FREE_NARRATION_CHARS - charsUsed);
    return {
      pro: false,
      limitChars: FREE_NARRATION_CHARS,
      usedChars: charsUsed,
      creditChars: 0,
      remainingChars,
      remaining: this.approxNarrations(remainingChars),
      resetsAt: null,
    };
  }

  /** Turn a character budget into a friendly whole-narration estimate. */
  private approxNarrations(chars: number): number {
    return Math.floor(Math.max(0, chars) / AVG_NARRATION_CHARS);
  }

  /** Characters of narration a Pro user can still generate now: whatever is
   *  left of the monthly budget (reset if the window lapsed) plus prepaid
   *  top-up credits, which are spent only after the monthly budget. */
  private proNarrationRemaining(u: { narrationCharsUsed: number; narrationPeriodStart: Date | null; narrationCreditChars: number }): number {
    const used = this.periodExpired(u.narrationPeriodStart) ? 0 : u.narrationCharsUsed;
    return Math.max(0, PRO_NARRATION_CHARS - used) + Math.max(0, u.narrationCreditChars);
  }

  /** Read-only narration budget for a user, as an approximate narration count.
   *  Used on a cache hit (free replay) so the client can still show the badge
   *  without spending anything. */
  async narrationRemaining(userId: string): Promise<{ pro: boolean; remaining: number }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true, narrationCharsUsed: true, narrationPeriodStart: true, narrationCreditChars: true },
    });
    if (!user) return { pro: false, remaining: 0 };
    const pro = this.isPro(user.plan) && (await this.currentPlan(userId)) === 'pro';
    const chars = pro ? this.proNarrationRemaining(user) : Math.max(0, FREE_NARRATION_CHARS - user.narrationCharsUsed);
    return { pro, remaining: this.approxNarrations(chars) };
  }

  /** Gate a NEW narration BEFORE spending provider credits. Checks the exact
   *  character count against the plan's remaining budget (Pro: monthly budget +
   *  top-up credits; free: lifetime taste). Throws 402 when the story is too
   *  long for the remaining budget, so the client can surface upgrade / top-up. */
  async assertNarrationAllowed(userId: string, chars: number): Promise<{ pro: boolean; remaining: number }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true, narrationCharsUsed: true, narrationPeriodStart: true, narrationCreditChars: true },
    });
    if (!user) throw new HttpException({ error: 'unauthorized' }, HttpStatus.UNAUTHORIZED);
    const pro = this.isPro(user.plan) && (await this.currentPlan(userId)) === 'pro';

    if (pro) {
      const available = this.proNarrationRemaining(user);
      if (chars > available) {
        throw new HttpException(
          {
            error: 'narration_quota_exceeded',
            topup: true,
            message: "You've used your narration budget for this month. Grab a top-up pack to narrate more; any story that's already been narrated stays free to replay.",
          },
          HttpStatus.PAYMENT_REQUIRED,
        );
      }
      return { pro: true, remaining: this.approxNarrations(available - chars) };
    }

    const available = Math.max(0, FREE_NARRATION_CHARS - user.narrationCharsUsed);
    if (chars > available) {
      throw new HttpException(
        {
          error: 'narration_quota_exceeded',
          upgrade: true,
          message: "You've used all your free narrations. Upgrade to Writer Pro to narrate more; you can still replay any story that's already been narrated.",
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }
    return { pro: false, remaining: this.approxNarrations(available - chars) };
  }

  /** Bill a delivered narration's characters, only after the audio exists.
   *  Free: lifetime counter. Pro: draw the monthly budget first (resetting a
   *  lapsed window), overflow from prepaid credits. Returns the new remaining
   *  as an approximate narration count. */
  async recordNarrationChars(userId: string, chars: number): Promise<{ pro: boolean; remaining: number }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true, narrationCharsUsed: true, narrationPeriodStart: true, narrationCreditChars: true },
    });
    if (!user) return { pro: false, remaining: 0 };
    const pro = this.isPro(user.plan) && (await this.currentPlan(userId)) === 'pro';

    if (!pro) {
      const updated = await this.prisma.user.update({
        where: { id: userId },
        data: { narrationCharsUsed: { increment: chars }, narrationCount: { increment: 1 } },
        select: { narrationCharsUsed: true },
      });
      return { pro: false, remaining: this.approxNarrations(FREE_NARRATION_CHARS - updated.narrationCharsUsed) };
    }

    const expired = this.periodExpired(user.narrationPeriodStart);
    const used = expired ? 0 : user.narrationCharsUsed;
    const fromPeriod = Math.min(chars, Math.max(0, PRO_NARRATION_CHARS - used));
    const fromCredits = chars - fromPeriod;
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        narrationCharsUsed: used + fromPeriod,
        narrationPeriodStart: expired ? new Date() : (user.narrationPeriodStart ?? new Date()),
        narrationCreditChars: Math.max(0, user.narrationCreditChars - fromCredits),
        narrationCount: { increment: 1 },
      },
      select: { narrationCharsUsed: true, narrationPeriodStart: true, narrationCreditChars: true },
    });
    return { pro: true, remaining: this.approxNarrations(this.proNarrationRemaining(updated)) };
  }

  /** Spend one AI credit against a rolling 30-day window that resets lazily.
   *  Free users get FREE_AI_MONTHLY_LIMIT; Pro users get PRO_AI_MONTHLY_LIMIT,
   *  a silent fair-use backstop that only bites scripted abuse (the UI still
   *  shows Pro as unlimited). Throws 429 when exhausted. */
  async consumeAiCredit(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true, aiUsageCount: true, aiUsagePeriodStart: true },
    });
    if (!user) return; // unknown user: no limit to apply

    const pro = this.isPro(user.plan) && (await this.currentPlan(userId)) === 'pro';
    const limit = pro ? PRO_AI_MONTHLY_LIMIT : FREE_AI_MONTHLY_LIMIT;

    const expired = this.periodExpired(user.aiUsagePeriodStart);
    const used = expired ? 0 : user.aiUsageCount;

    if (used >= limit) {
      throw new HttpException(
        pro
          ? {
              error: 'ai_fair_use_exceeded',
              message: "You've hit this month's fair-use limit for AI assistance. That's unusually high volume; contact us if you have a legitimate need.",
            }
          : {
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

  // ── Razorpay (India, INR / UPI) ────────────────────────────────────────
  /** Create a Razorpay subscription and return its hosted auth/checkout URL
   *  (short_url) for the client to redirect to, mirroring the Stripe flow. */
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
  async createRazorpayOrder(userId: string, currency = 'INR', term: ProTerm = 'monthly') {
    if (!this.razorpay) throw new BadRequestException('Razorpay is not configured yet.');
    const annual = term === 'annual';
    const amount = (annual ? PRO_ANNUAL_PRICES : PRO_ONE_TIME_PRICES)[currency];
    const days = annual ? PRO_ANNUAL_DAYS : PRO_ONE_TIME_DAYS;
    if (!amount) throw new BadRequestException('Unsupported currency.');
    if (currency !== 'INR' && !this.razorpayInternational) {
      throw new BadRequestException('International payments are not enabled yet.');
    }
    // A subscription-provider Pro (Stripe / Razorpay subscription) buying a
    // one-time pass would leave two overlapping billing arrangements; only
    // free users and one-time pass holders (extending) may buy passes.
    const buyer = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true, billingProvider: true },
    });
    if (buyer?.plan === 'pro' && buyer.billingProvider && buyer.billingProvider !== 'razorpay_onetime') {
      throw new BadRequestException(
        'You already have an auto-renewing subscription. Manage or cancel it from Settings instead of buying a pass.',
      );
    }
    const order: any = await this.razorpay.orders.create({
      amount,
      currency,
      receipt: `pro-${Date.now().toString(36)}`,
      // Capture immediately on success; without this, accounts set to manual
      // capture leave the payment "authorized" and it auto-refunds in 5 days
      // even though Pro was already granted.
      payment_capture: 1,
      notes: { userId, purpose: `writer-pro-${days}d` },
    } as any);
    return {
      orderId: order.id as string,
      amount: order.amount as number,
      currency: order.currency as string,
      keyId: process.env.RAZORPAY_KEY_ID!,
      days,
    };
  }

  /** Create an order for one prepaid narration top-up pack. Pro only; top-ups
   *  extend the Pro monthly budget, so a free user should upgrade first. Cut
   *  through the same Checkout + verify flow, tagged by notes.purpose. */
  async createNarrationTopupOrder(userId: string, currency = 'INR') {
    if (!this.razorpay) throw new BadRequestException('Razorpay is not configured yet.');
    if ((await this.currentPlan(userId)) !== 'pro') {
      throw new BadRequestException('Narration top-ups are for Writer Pro; upgrade to Pro first.');
    }
    const amount = NARRATION_TOPUP_PRICES[currency];
    if (!amount) throw new BadRequestException('Unsupported currency.');
    if (currency !== 'INR' && !this.razorpayInternational) {
      throw new BadRequestException('International payments are not enabled yet.');
    }
    const order: any = await this.razorpay.orders.create({
      amount,
      currency,
      receipt: `topup-${Date.now().toString(36)}`,
      payment_capture: 1,
      notes: { userId, purpose: 'narration-topup', chars: String(NARRATION_TOPUP_CHARS) },
    } as any);
    return {
      orderId: order.id as string,
      amount: order.amount as number,
      currency: order.currency as string,
      keyId: process.env.RAZORPAY_KEY_ID!,
      chars: NARRATION_TOPUP_CHARS,
      narrations: this.approxNarrations(NARRATION_TOPUP_CHARS),
    };
  }

  /** Verify a Checkout payment and grant Pro. The signature,
   *  HMAC-SHA256(order_id|payment_id, key secret), only Razorpay can produce;
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
    const currency = order?.currency as string;
    const purpose = order?.notes?.purpose as string | undefined;

    // Narration top-up: add prepaid characters instead of granting Pro.
    if (purpose === 'narration-topup') {
      const expectedTopup = NARRATION_TOPUP_PRICES[currency];
      if (!expectedTopup || Number(order?.amount) !== expectedTopup) {
        throw new BadRequestException('Unexpected order amount.');
      }
      if (!(await this.firstTime(paymentId, 'razorpay', 'payment'))) {
        return { ok: true, alreadyProcessed: true }; // replayed verify, no free credits
      }
      const chars = Number(order?.notes?.chars) || NARRATION_TOPUP_CHARS;
      await this.prisma.user.update({
        where: { id: userId },
        data: { narrationCreditChars: { increment: chars } },
      });
      return { ok: true, topup: true, addedChars: chars, addedNarrations: this.approxNarrations(chars) };
    }

    // Otherwise: a Writer Pro window. The term comes from the order's own
    // purpose note (set server-side at order creation, so it can't be forged
    // by the client), and the amount must match that term's price exactly.
    const annual = purpose === `writer-pro-${PRO_ANNUAL_DAYS}d`;
    const expectedAmount = (annual ? PRO_ANNUAL_PRICES : PRO_ONE_TIME_PRICES)[currency];
    if (!expectedAmount || Number(order?.amount) !== expectedAmount) {
      throw new BadRequestException('Unexpected order amount.');
    }

    if (!(await this.firstTime(paymentId, 'razorpay', 'payment'))) {
      return { ok: true, alreadyProcessed: true }; // replayed verify, no free extension
    }

    // Carry-over: an active one-time Pro buying again (e.g. a monthly holder
    // upgrading to the annual pass) keeps the days already paid for; the new
    // window starts where the current one ends, never from "now".
    const current = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true, billingProvider: true, planRenewsAt: true },
    });
    const activeOneTimeUntil =
      current?.plan === 'pro' &&
      current.billingProvider === 'razorpay_onetime' &&
      current.planRenewsAt &&
      new Date(current.planRenewsAt).getTime() > Date.now()
        ? new Date(current.planRenewsAt).getTime()
        : Date.now();

    const days = annual ? PRO_ANNUAL_DAYS : PRO_ONE_TIME_DAYS;
    const proUntil = new Date(activeOneTimeUntil + days * 24 * 60 * 60 * 1000);
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
        'Writer Pro was a one-time purchase, so there is nothing to cancel. Pro simply ends on the expiry date.',
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

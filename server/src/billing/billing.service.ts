import { Injectable, Inject, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';

/** Free writers get this many AI actions per rolling 30-day window. Pro is
 *  unlimited. Tuned to be generous enough for a hobby writer but to make a
 *  serious one feel the ceiling. */
export const FREE_AI_MONTHLY_LIMIT = 25;
const PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class BillingService {
  private stripe: Stripe | null = null;

  constructor(@Inject(PrismaService) private prisma: PrismaService) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (key) this.stripe = new Stripe(key);
  }

  /** Billing only works once Stripe keys are configured; until then the rest of
   *  the app (free tier + AI metering) runs normally and upgrade calls 400. */
  get enabled(): boolean {
    return !!this.stripe;
  }

  isPro(plan?: string | null): boolean {
    return plan === 'pro';
  }

  /** Plan + AI-quota snapshot for the settings / pricing / assistant screens. */
  async getStatus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true, planRenewsAt: true, aiUsageCount: true, aiUsagePeriodStart: true },
    });
    const pro = this.isPro(user?.plan);
    const expired = this.periodExpired(user?.aiUsagePeriodStart ?? null);
    const used = expired ? 0 : user?.aiUsageCount ?? 0;
    const resetsAt = this.periodEnd(user?.aiUsagePeriodStart ?? null, expired);

    return {
      plan: user?.plan ?? 'free',
      pro,
      renewsAt: user?.planRenewsAt ?? null,
      billingEnabled: this.enabled,
      ai: {
        used: pro ? 0 : used,
        limit: pro ? null : FREE_AI_MONTHLY_LIMIT,
        remaining: pro ? null : Math.max(0, FREE_AI_MONTHLY_LIMIT - used),
        resetsAt: pro ? null : resetsAt,
      },
    };
  }

  /** Spend one AI credit. Pro is unlimited; free users draw from a rolling
   *  30-day quota that resets lazily. Throws 429 when exhausted so the client
   *  can surface an upgrade prompt. */
  async consumeAiCredit(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true, aiUsageCount: true, aiUsagePeriodStart: true },
    });
    if (!user || this.isPro(user.plan)) return; // unknown user or Pro: no limit

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
        stripeSubscriptionId: sub.id,
        planRenewsAt: active && periodEnd ? new Date(periodEnd * 1000) : null,
      },
    });
  }

  private async downgradeByCustomer(customerId: string) {
    await this.prisma.user.updateMany({
      where: { stripeCustomerId: customerId },
      data: { plan: 'free', planRenewsAt: null, stripeSubscriptionId: null },
    });
  }
}

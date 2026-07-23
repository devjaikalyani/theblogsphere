import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createHmac } from 'crypto';
import {
  BillingService,
  FREE_NARRATION_CHARS,
  WRITER_NARRATION_CHARS,
  PRO_NARRATION_CHARS,
  NARRATION_TOPUP_CHARS,
} from './billing.service';

const AVG = 6_400; // must match AVG_NARRATION_CHARS in the service

// A Prisma-style `data` object can contain `{ increment: n }`; apply it like the
// real client would so methods that read their own update result behave.
function applyData(base: any, data: any) {
  const out = { ...(base ?? {}) };
  for (const [k, v] of Object.entries(data ?? {})) {
    out[k] = v && typeof v === 'object' && 'increment' in (v as any)
      ? (base?.[k] ?? 0) + (v as any).increment
      : v;
  }
  return out;
}

function makeService(opts: { user?: any; razorpay?: any; billingEventCreate?: () => Promise<any> } = {}) {
  const updates: any[] = [];
  const prisma: any = {
    user: {
      findUnique: vi.fn(async () => (opts.user ? { ...opts.user } : null)),
      update: vi.fn(async ({ data }: any) => {
        updates.push(data);
        return applyData(opts.user, data);
      }),
    },
    billingEvent: {
      create: vi.fn(opts.billingEventCreate ?? (async () => ({}))),
    },
  };
  const svc = new BillingService(prisma);
  if (opts.razorpay) (svc as any).razorpay = opts.razorpay;
  return { svc, prisma, updates };
}

const freeUser = (over: any = {}) => ({
  plan: 'free', billingProvider: null, planRenewsAt: null,
  narrationCharsUsed: 0, narrationPeriodStart: null, narrationCreditChars: 0,
  ...over,
});
const proUser = (over: any = {}) => ({
  plan: 'pro', billingProvider: 'razorpay', planRenewsAt: new Date(Date.now() + 20 * 864e5),
  narrationCharsUsed: 0, narrationPeriodStart: new Date(), narrationCreditChars: 0,
  ...over,
});
const writerUser = (over: any = {}) => ({
  plan: 'writer', billingProvider: 'razorpay_onetime', planRenewsAt: new Date(Date.now() + 20 * 864e5),
  narrationCharsUsed: 0, narrationPeriodStart: new Date(), narrationCreditChars: 0,
  ...over,
});

describe('narration character metering', () => {
  it('turns a character budget into a friendly narration count', () => {
    const { svc } = makeService();
    const approx = (n: number) => (svc as any).approxNarrations(n);
    expect(approx(FREE_NARRATION_CHARS)).toBe(7);
    expect(approx(PRO_NARRATION_CHARS)).toBe(20);
    expect(approx(NARRATION_TOPUP_CHARS)).toBe(15);
    expect(approx(-500)).toBe(0);
  });

  it('lets a free reader narrate within the lifetime budget', async () => {
    const { svc } = makeService({ user: freeUser({ narrationCharsUsed: 6_000 }) });
    const gate = await svc.assertNarrationAllowed('u1', 6_000);
    expect(gate.pro).toBe(false);
    expect(gate.remaining).toBe(Math.floor((FREE_NARRATION_CHARS - 12_000) / AVG));
  });

  it('blocks a free reader whose story exceeds the remaining budget', async () => {
    const { svc } = makeService({ user: freeUser({ narrationCharsUsed: 44_000 }) });
    await expect(svc.assertNarrationAllowed('u1', 6_000)).rejects.toMatchObject({
      status: 402,
      response: { error: 'narration_quota_exceeded', upgrade: true },
    });
  });

  it('blocks an exhausted Pro user with a top-up prompt (not upgrade)', async () => {
    const { svc } = makeService({ user: proUser({ narrationCharsUsed: 128_000 }) });
    await expect(svc.assertNarrationAllowed('u1', 6_000)).rejects.toMatchObject({
      status: 402,
      response: { error: 'narration_quota_exceeded', topup: true },
    });
  });

  it('lets an over-budget Pro user draw from prepaid top-up credits', async () => {
    const { svc } = makeService({ user: proUser({ narrationCharsUsed: 130_000, narrationCreditChars: 50_000 }) });
    const gate = await svc.assertNarrationAllowed('u1', 6_000);
    expect(gate.pro).toBe(true);
  });

  it('bills free narration against the lifetime counter', async () => {
    const { svc, updates } = makeService({ user: freeUser({ narrationCharsUsed: 6_000 }) });
    await svc.recordNarrationChars('u1', 6_000);
    expect(updates[0].narrationCharsUsed).toEqual({ increment: 6_000 });
    expect(updates[0].narrationCount).toEqual({ increment: 1 });
  });

  it('bills Pro narration from the monthly budget first, then credits', async () => {
    const { svc, updates } = makeService({ user: proUser({ narrationCharsUsed: 128_000, narrationCreditChars: 50_000 }) });
    await svc.recordNarrationChars('u1', 6_000); // 2,000 from budget, 4,000 from credits
    expect(updates[0].narrationCharsUsed).toBe(PRO_NARRATION_CHARS); // 128k + 2k
    expect(updates[0].narrationCreditChars).toBe(46_000); // 50k - 4k
  });

  it('meters a Writer against the smaller Writer narration budget', async () => {
    const { svc } = makeService({ user: writerUser({ narrationCharsUsed: WRITER_NARRATION_CHARS - 3_000 }) });
    // Within the remaining Writer budget: allowed, and flagged as a paid path.
    const ok = await svc.assertNarrationAllowed('u1', 2_000);
    expect(ok.pro).toBe(true);
    // Beyond the remaining Writer budget: a top-up prompt (not an upgrade one).
    await expect(svc.assertNarrationAllowed('u1', 6_000)).rejects.toMatchObject({
      status: 402,
      response: { error: 'narration_quota_exceeded', topup: true },
    });
  });
});

describe('razorpay payment verification', () => {
  const secret = 'test_secret_key';
  const sign = (orderId: string, paymentId: string) =>
    createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');

  beforeEach(() => {
    process.env.RAZORPAY_KEY_SECRET = secret;
  });

  const proOrder = { id: 'order_1', currency: 'INR', amount: 39900, notes: { userId: 'u1', purpose: 'plan-pro-30d' } };

  it('grants Pro on a valid signature + matching order', async () => {
    const { svc, updates } = makeService({
      user: proUser(),
      razorpay: { orders: { fetch: vi.fn(async () => proOrder) } },
    });
    const res: any = await svc.verifyRazorpayPayment('u1', {
      orderId: 'order_1', paymentId: 'pay_1', signature: sign('order_1', 'pay_1'),
    });
    expect(res.ok).toBe(true);
    expect(res.plan).toBe('pro');
    expect(updates[0]).toMatchObject({ plan: 'pro', billingProvider: 'razorpay_onetime' });
  });

  it('grants the Writer tier for a ₹149 Writer order', async () => {
    const order = { id: 'order_w', currency: 'INR', amount: 14900, notes: { userId: 'u1', purpose: 'plan-writer-30d' } };
    const { svc, updates } = makeService({ user: freeUser(), razorpay: { orders: { fetch: vi.fn(async () => order) } } });
    const res: any = await svc.verifyRazorpayPayment('u1', {
      orderId: 'order_w', paymentId: 'pay_w', signature: sign('order_w', 'pay_w'),
    });
    expect(res.plan).toBe('writer');
    expect(updates[0]).toMatchObject({ plan: 'writer', billingProvider: 'razorpay_onetime' });
  });

  it('rejects a Writer order paid at less than the Writer price', async () => {
    const order = { id: 'order_w2', currency: 'INR', amount: 9900, notes: { userId: 'u1', purpose: 'plan-writer-30d' } };
    const { svc } = makeService({ user: freeUser(), razorpay: { orders: { fetch: vi.fn(async () => order) } } });
    await expect(svc.verifyRazorpayPayment('u1', {
      orderId: 'order_w2', paymentId: 'pay_w2', signature: sign('order_w2', 'pay_w2'),
    })).rejects.toThrow(/amount/i);
  });

  it('still honours a legacy one-time Pro order (writer-pro-30d) as Pro', async () => {
    const order = { id: 'order_l', currency: 'INR', amount: 39900, notes: { userId: 'u1', purpose: 'writer-pro-30d' } };
    const { svc, updates } = makeService({ user: freeUser(), razorpay: { orders: { fetch: vi.fn(async () => order) } } });
    const res: any = await svc.verifyRazorpayPayment('u1', {
      orderId: 'order_l', paymentId: 'pay_l', signature: sign('order_l', 'pay_l'),
    });
    expect(res.plan).toBe('pro');
    expect(updates[0]).toMatchObject({ plan: 'pro', billingProvider: 'razorpay_onetime' });
  });

  it('rejects a tampered signature', async () => {
    const { svc } = makeService({ user: proUser(), razorpay: { orders: { fetch: vi.fn(async () => proOrder) } } });
    await expect(svc.verifyRazorpayPayment('u1', {
      orderId: 'order_1', paymentId: 'pay_1', signature: sign('order_1', 'pay_1').replace(/.$/, '0'),
    })).rejects.toThrow(/signature/i);
  });

  it('rejects a payment that belongs to another account', async () => {
    const order = { ...proOrder, notes: { ...proOrder.notes, userId: 'someone_else' } };
    const { svc } = makeService({ user: proUser(), razorpay: { orders: { fetch: vi.fn(async () => order) } } });
    await expect(svc.verifyRazorpayPayment('u1', {
      orderId: 'order_1', paymentId: 'pay_1', signature: sign('order_1', 'pay_1'),
    })).rejects.toThrow(/different account/i);
  });

  it('rejects an order whose amount is not the Pro price', async () => {
    const order = { ...proOrder, amount: 100 };
    const { svc } = makeService({ user: proUser(), razorpay: { orders: { fetch: vi.fn(async () => order) } } });
    await expect(svc.verifyRazorpayPayment('u1', {
      orderId: 'order_1', paymentId: 'pay_1', signature: sign('order_1', 'pay_1'),
    })).rejects.toThrow(/amount/i);
  });

  it('grants a 365-day window for an annual-pass order at the annual price', async () => {
    const order = { id: 'order_3', currency: 'INR', amount: 299900, notes: { userId: 'u1', purpose: 'plan-pro-365d' } };
    const { svc, updates } = makeService({ user: freeUser(), razorpay: { orders: { fetch: vi.fn(async () => order) } } });
    const res: any = await svc.verifyRazorpayPayment('u1', {
      orderId: 'order_3', paymentId: 'pay_3', signature: sign('order_3', 'pay_3'),
    });
    expect(res.plan).toBe('pro');
    const days = (new Date(res.proUntil).getTime() - Date.now()) / 864e5;
    expect(days).toBeGreaterThan(364);
    expect(days).toBeLessThanOrEqual(365);
    expect(updates[0]).toMatchObject({ plan: 'pro', billingProvider: 'razorpay_onetime' });
  });

  it('rejects an annual-pass order paid at the monthly price', async () => {
    const order = { id: 'order_4', currency: 'INR', amount: 39900, notes: { userId: 'u1', purpose: 'plan-pro-365d' } };
    const { svc } = makeService({ user: freeUser(), razorpay: { orders: { fetch: vi.fn(async () => order) } } });
    await expect(svc.verifyRazorpayPayment('u1', {
      orderId: 'order_4', paymentId: 'pay_4', signature: sign('order_4', 'pay_4'),
    })).rejects.toThrow(/amount/i);
  });

  it('carries remaining days over when an active one-time Pro extends with the annual pass', async () => {
    const tenDaysLeft = new Date(Date.now() + 10 * 864e5);
    const order = { id: 'order_5', currency: 'INR', amount: 299900, notes: { userId: 'u1', purpose: 'plan-pro-365d' } };
    const { svc } = makeService({
      user: proUser({ billingProvider: 'razorpay_onetime', planRenewsAt: tenDaysLeft }),
      razorpay: { orders: { fetch: vi.fn(async () => order) } },
    });
    const res: any = await svc.verifyRazorpayPayment('u1', {
      orderId: 'order_5', paymentId: 'pay_5', signature: sign('order_5', 'pay_5'),
    });
    const days = (new Date(res.proUntil).getTime() - Date.now()) / 864e5;
    expect(days).toBeGreaterThan(374); // 365 + ~10 carried over, not 365 from now
    expect(days).toBeLessThanOrEqual(375);
  });

  it('starts from now (no carry-over) when the previous one-time pass already expired', async () => {
    const expired = new Date(Date.now() - 5 * 864e5);
    const order = { id: 'order_6', currency: 'INR', amount: 299900, notes: { userId: 'u1', purpose: 'plan-pro-365d' } };
    const { svc } = makeService({
      user: proUser({ billingProvider: 'razorpay_onetime', planRenewsAt: expired }),
      razorpay: { orders: { fetch: vi.fn(async () => order) } },
    });
    const res: any = await svc.verifyRazorpayPayment('u1', {
      orderId: 'order_6', paymentId: 'pay_6', signature: sign('order_6', 'pay_6'),
    });
    const days = (new Date(res.proUntil).getTime() - Date.now()) / 864e5;
    expect(days).toBeGreaterThan(364);
    expect(days).toBeLessThanOrEqual(365);
  });

  it('blocks a subscription-provider Pro from creating a one-time pass order', async () => {
    const { svc } = makeService({
      user: proUser({ billingProvider: 'razorpay' }),
      razorpay: { orders: { create: vi.fn(async () => ({ id: 'order_x' })) } },
    });
    await expect(svc.createRazorpayOrder('u1', 'INR', 'annual')).rejects.toThrow(/subscription/i);
  });

  it('adds prepaid credits for a narration top-up order', async () => {
    const order = { id: 'order_2', currency: 'INR', amount: 19900, notes: { userId: 'u1', purpose: 'narration-topup', chars: String(NARRATION_TOPUP_CHARS) } };
    const { svc, updates } = makeService({ user: proUser(), razorpay: { orders: { fetch: vi.fn(async () => order) } } });
    const res: any = await svc.verifyRazorpayPayment('u1', {
      orderId: 'order_2', paymentId: 'pay_2', signature: sign('order_2', 'pay_2'),
    });
    expect(res.topup).toBe(true);
    expect(updates[0].narrationCreditChars).toEqual({ increment: NARRATION_TOPUP_CHARS });
  });

  it('treats a replayed payment id as an idempotent no-op', async () => {
    const { svc, updates } = makeService({
      user: proUser(),
      razorpay: { orders: { fetch: vi.fn(async () => proOrder) } },
      billingEventCreate: async () => { throw { code: 'P2002' }; }, // unique-constraint = already seen
    });
    const res: any = await svc.verifyRazorpayPayment('u1', {
      orderId: 'order_1', paymentId: 'pay_1', signature: sign('order_1', 'pay_1'),
    });
    expect(res.alreadyProcessed).toBe(true);
    expect(updates.length).toBe(0); // no second Pro grant
  });
});

/**
 * Fail-fast environment validation. Runs when ConfigModule initialises, so a
 * misconfigured deploy crashes immediately with a clear message instead of
 * failing later at runtime (e.g. a 500 on the first upload or OAuth attempt).
 *
 * Zero dependencies — no Joi/zod needed.
 */

const ALWAYS_REQUIRED = ['DATABASE_URL', 'BETTER_AUTH_SECRET'];

const REQUIRED_IN_PRODUCTION = [
  'BETTER_AUTH_URL',
  'ALLOWED_ORIGINS',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GROQ_API_KEY',
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
  'R2_PUBLIC_URL',
];

// Payment gateways are optional, but a half-configured one is worse than none:
// the upgrade button appears and then checkout (or the webhook that grants Pro)
// fails after the user has committed. Razorpay has two valid shapes — API keys
// alone (one-time Standard Checkout, verified synchronously) or keys + plan +
// webhook secret (subscriptions); a plan without its webhook would take money
// and never grant Pro, so that pairing is enforced below.
const GATEWAY_GROUPS: Record<string, string[]> = {
  Razorpay: ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET'],
  Stripe: ['STRIPE_SECRET_KEY', 'STRIPE_PRICE_PRO', 'STRIPE_WEBHOOK_SECRET'],
};

export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const isProd = config['NODE_ENV'] === 'production';
  const required = [...ALWAYS_REQUIRED, ...(isProd ? REQUIRED_IN_PRODUCTION : [])];

  const isSet = (key: string) => {
    const v = config[key];
    return !(v === undefined || v === null || String(v).trim() === '');
  };

  const missing = required.filter((key) => !isSet(key));

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(', ')}. ` +
        `Set them in your .env (or deployment secrets). See .env.example.`,
    );
  }

  for (const [gateway, keys] of Object.entries(GATEWAY_GROUPS)) {
    const set = keys.filter(isSet);
    if (set.length > 0 && set.length < keys.length) {
      const absent = keys.filter((k) => !isSet(k));
      throw new Error(
        `${gateway} is partially configured — set all of ${keys.join(', ')} to enable it ` +
          `(missing: ${absent.join(', ')}) or unset the group entirely to keep it disabled.`,
      );
    }
  }

  const razorpayExtras = ['RAZORPAY_PLAN_PRO', 'RAZORPAY_WEBHOOK_SECRET'];
  if (razorpayExtras.some(isSet) && !GATEWAY_GROUPS['Razorpay'].every(isSet)) {
    throw new Error(
      'RAZORPAY_PLAN_PRO / RAZORPAY_WEBHOOK_SECRET are set but the API keys are not — ' +
        'set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET as well.',
    );
  }
  if (isSet('RAZORPAY_PLAN_PRO') && !isSet('RAZORPAY_WEBHOOK_SECRET')) {
    throw new Error(
      'RAZORPAY_PLAN_PRO is set without RAZORPAY_WEBHOOK_SECRET — subscriptions are granted ' +
        'by the webhook, so without its secret users would pay and never receive Pro. ' +
        'Set the webhook secret, or unset the plan to fall back to one-time checkout.',
    );
  }

  if (config['BETTER_AUTH_SECRET'] && String(config['BETTER_AUTH_SECRET']).length < 16) {
    throw new Error('BETTER_AUTH_SECRET must be a long random string (>= 16 chars).');
  }

  if (isProd && String(config['BETTER_AUTH_URL'] ?? '').startsWith('http://')) {
    console.warn('[SECURITY] BETTER_AUTH_URL is not HTTPS in production — auth cookies may be rejected.');
  }

  return config;
}

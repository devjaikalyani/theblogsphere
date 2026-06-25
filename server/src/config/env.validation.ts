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

export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const isProd = config['NODE_ENV'] === 'production';
  const required = [...ALWAYS_REQUIRED, ...(isProd ? REQUIRED_IN_PRODUCTION : [])];

  const missing = required.filter((key) => {
    const v = config[key];
    return v === undefined || v === null || String(v).trim() === '';
  });

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(', ')}. ` +
        `Set them in your .env (or deployment secrets). See .env.example.`,
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

import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'postgresql' }),

  trustedOrigins: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:4200', 'http://localhost:3000', 'http://192.168.1.8:4200'],

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    // Reset mails go out via Resend's REST API (no SDK needed). Env-gated:
    // without RESEND_API_KEY the request still answers 200 (no account
    // enumeration) but logs loudly that nothing was sent.
    sendResetPassword: async ({ user, url }) => {
      const apiKey = process.env.RESEND_API_KEY;
      const from = process.env.EMAIL_FROM || 'TheBlogSphere <onboarding@resend.dev>';
      if (!apiKey) {
        console.warn('[AUTH] RESEND_API_KEY is not set — password reset email NOT sent to', user.email);
        return;
      }
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from,
          to: user.email,
          subject: 'Reset your TheBlogSphere password',
          text:
            `Hi ${user.name ?? 'there'},\n\n` +
            `Someone (hopefully you) asked to reset the password for this account. ` +
            `Open the link below to choose a new one — it expires in one hour.\n\n${url}\n\n` +
            `If you didn't request this, you can safely ignore this email.`,
        }),
      });
      if (!res.ok) {
        console.error('[AUTH] Password reset email failed:', res.status, await res.text().catch(() => ''));
      }
    },
  },

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      redirectURI: process.env.GOOGLE_CALLBACK_URL,
      // firstName/lastName are required (NOT NULL) on the User model, but
      // Better Auth's default Google profile only maps name/email/image.
      // Without this, creating a brand-new Google user violates the NOT NULL
      // constraint, the OAuth callback errors out, and the user is bounced
      // back to the logged-out page instead of the signed-in home.
      mapProfileToUser: (profile: any) => {
        const parts = (profile.name ?? '').trim().split(/\s+/).filter(Boolean);
        return {
          firstName: profile.given_name || parts[0] || 'User',
          lastName: profile.family_name || parts.slice(1).join(' ') || '',
          profilePicture: profile.picture || '/images/default-profile.png',
        };
      },
    },
  },

  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ['google'],
      // Password-signup users are stored with emailVerified: false (no
      // verification flow is configured). Better Auth otherwise refuses to
      // link a social account to a local user whose email isn't verified,
      // even for a trusted provider. Allow linking in that case.
      requireLocalEmailVerified: false,
    },
  },

  session: {
    expiresIn: 60 * 60 * 24,
    updateAge: 60 * 60,
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5,
    },
  },

  user: {
    additionalFields: {
      firstName: { type: 'string', required: true },
      lastName: { type: 'string', required: true },
      profilePicture: { type: 'string', required: false },
    },
  },
});

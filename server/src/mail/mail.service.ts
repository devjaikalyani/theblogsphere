import { Injectable } from '@nestjs/common';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

/** Transactional email over Resend's REST API (no SDK), shared by password
 *  resets, publish notifications, and admin alerts. Env-gated: without
 *  RESEND_API_KEY every send is a logged no-op, so local/dev stay silent and
 *  nothing in the request path ever depends on email succeeding. */
@Injectable()
export class MailService {
  private get apiKey(): string | undefined {
    return process.env.RESEND_API_KEY;
  }
  private get from(): string {
    return process.env.EMAIL_FROM || 'TheBlogSphere <onboarding@resend.dev>';
  }

  get enabled(): boolean {
    return !!this.apiKey;
  }

  async send(msg: MailMessage): Promise<boolean> {
    if (!this.apiKey) {
      console.warn('[MAIL] RESEND_API_KEY is not set; email NOT sent to', msg.to);
      return false;
    }
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: this.from, to: msg.to, subject: msg.subject, text: msg.text }),
    });
    if (!res.ok) {
      console.error('[MAIL] send failed:', res.status, await res.text().catch(() => ''));
      return false;
    }
    return true;
  }

  /** Fan-out helper: Resend's batch endpoint takes up to 100 messages per
   *  call, so chunk and send sequentially (keeps us inside its rate limit
   *  without a queue). Best-effort: a failed chunk is logged, not retried. */
  async sendBatch(messages: MailMessage[]): Promise<number> {
    if (!messages.length) return 0;
    if (!this.apiKey) {
      console.warn(`[MAIL] RESEND_API_KEY is not set; batch of ${messages.length} NOT sent`);
      return 0;
    }
    let sent = 0;
    for (let i = 0; i < messages.length; i += 100) {
      const chunk = messages.slice(i, i + 100).map((m) => ({
        from: this.from,
        to: m.to,
        subject: m.subject,
        text: m.text,
      }));
      const res = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(chunk),
      });
      if (res.ok) sent += chunk.length;
      else console.error('[MAIL] batch send failed:', res.status, await res.text().catch(() => ''));
    }
    return sent;
  }
}

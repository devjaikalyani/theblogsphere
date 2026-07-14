import { Controller, Post, Get, Body, Req, Headers, UseGuards, Inject, RawBodyRequest } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Request } from 'express';
import { BillingService } from './billing.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('api/billing')
export class BillingController {
  constructor(@Inject(BillingService) private billing: BillingService) {}

  @Get('status')
  @UseGuards(AuthGuard)
  async status(@CurrentUser('id') userId: string) {
    return this.billing.getStatus(userId);
  }

  // Public (no auth): gateway availability + mode, no user data. Lets the
  // pricing page show the correct buttons and billing terms (one-time vs
  // auto-renewing) to logged-out visitors too.
  @Get('config')
  config() {
    return this.billing.publicConfig();
  }

  // provider: 'razorpay' (India/INR/UPI) or 'stripe' (international/USD).
  @Post('checkout')
  @UseGuards(AuthGuard)
  async checkout(@CurrentUser() user: any, @Body('provider') provider?: string) {
    if (provider === 'razorpay') {
      return this.billing.createRazorpaySubscription(user.id, user.email);
    }
    return this.billing.createCheckoutSession(user.id, user.email);
  }

  // Razorpay Standard Checkout (keys-only mode): create an order for one Pro
  // window; the client opens the Checkout modal with it. currency: 'INR'
  // (default) or 'USD' (international cards, when enabled)...
  @Post('razorpay/order')
  @UseGuards(AuthGuard)
  async razorpayOrder(
    @CurrentUser('id') userId: string,
    @Body('currency') currency?: string,
    @Body('term') term?: string,
  ) {
    return this.billing.createRazorpayOrder(
      userId,
      currency ?? 'INR',
      term === 'annual' ? 'annual' : 'monthly',
    );
  }

  // Prepaid narration top-up pack (Pro only): same Checkout modal + verify
  // flow, distinguished server-side by the order's notes.purpose.
  @Post('razorpay/topup')
  @UseGuards(AuthGuard)
  async razorpayTopup(@CurrentUser('id') userId: string, @Body('currency') currency?: string) {
    return this.billing.createNarrationTopupOrder(userId, currency ?? 'INR');
  }

  // ...then posts the modal's payment id + signature here. Signature (HMAC)
  // verification grants Pro synchronously, no webhook round-trip.
  @Post('razorpay/verify')
  @UseGuards(AuthGuard)
  async razorpayVerify(
    @CurrentUser('id') userId: string,
    @Body() body: { orderId?: string; paymentId?: string; signature?: string },
  ) {
    return this.billing.verifyRazorpayPayment(userId, body);
  }

  // Stripe -> hosted billing portal URL; Razorpay -> cancels at cycle end.
  @Post('manage')
  @UseGuards(AuthGuard)
  async manage(@CurrentUser('id') userId: string) {
    return this.billing.manageOrCancel(userId);
  }

  // Public webhooks: signature verification (not auth) is the gate, and both
  // need the raw body (app is created with `rawBody: true`).
  @SkipThrottle()
  @Post('webhook')
  async stripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    return this.billing.handleWebhook(req.rawBody as Buffer, signature);
  }

  @SkipThrottle()
  @Post('razorpay-webhook')
  async razorpayWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-razorpay-signature') signature: string,
    @Headers('x-razorpay-event-id') eventId?: string,
  ) {
    return this.billing.handleRazorpayWebhook(req.rawBody as Buffer, signature, eventId);
  }
}

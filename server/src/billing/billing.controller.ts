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

  // provider: 'razorpay' (India/INR/UPI) or 'stripe' (international/USD).
  @Post('checkout')
  @UseGuards(AuthGuard)
  async checkout(@CurrentUser() user: any, @Body('provider') provider?: string) {
    if (provider === 'razorpay') {
      return this.billing.createRazorpaySubscription(user.id, user.email);
    }
    return this.billing.createCheckoutSession(user.id, user.email);
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
  ) {
    return this.billing.handleRazorpayWebhook(req.rawBody as Buffer, signature);
  }
}

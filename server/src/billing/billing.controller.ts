import { Controller, Post, Get, Req, Headers, UseGuards, Inject, RawBodyRequest } from '@nestjs/common';
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

  @Post('checkout')
  @UseGuards(AuthGuard)
  async checkout(@CurrentUser() user: any) {
    return this.billing.createCheckoutSession(user.id, user.email);
  }

  @Post('portal')
  @UseGuards(AuthGuard)
  async portal(@CurrentUser('id') userId: string) {
    return this.billing.createPortalSession(userId);
  }

  // Public: Stripe calls this. Signature verification (not auth) is the gate,
  // and it needs the raw body, so the app is created with `rawBody: true`.
  @SkipThrottle()
  @Post('webhook')
  async webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    return this.billing.handleWebhook(req.rawBody as Buffer, signature);
  }
}

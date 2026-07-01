import { Controller, Post, Param, ParseIntPipe, UseGuards, Inject } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { TtsService } from './tts.service';
import { BillingService } from '../billing/billing.service';

@Controller('api/tts')
export class TtsController {
  constructor(
    @Inject(TtsService) private tts: TtsService,
    @Inject(BillingService) private billing: BillingService,
  ) {}

  /** Neural narration for a story. Sign-in required (so usage can be metered);
   *  free readers get a handful before the Pro paywall (402). The audio itself
   *  is cached in R2, so the provider is only billed the first time. */
  @Post(':blogId')
  @UseGuards(AuthGuard)
  async narrate(@Param('blogId', ParseIntPipe) blogId: number, @CurrentUser('id') userId: string) {
    // Enforce the quota BEFORE generating so over-limit users never cost money.
    const quota = await this.billing.assertNarrationAllowed(userId);
    const url = await this.tts.getNarrationUrl(blogId);
    // Bill only once the audio is actually available.
    await this.billing.recordNarration(userId);
    return {
      url,
      pro: quota.pro,
      remaining: quota.pro ? null : Math.max(0, (quota.remaining ?? 0) - 1),
    };
  }
}

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

  /** Neural narration for a story. Sign-in required (so usage can be metered).
   *  The audio is cached in R2, so re-listening to an already-narrated story is
   *  free for everyone and unmetered; only generating NEW audio (a cache miss)
   *  draws down the character budget (402 when the plan's budget is exhausted). */
  @Post(':blogId')
  @UseGuards(AuthGuard)
  async narrate(@Param('blogId', ParseIntPipe) blogId: number, @CurrentUser('id') userId: string) {
    const prep = await this.tts.prepareNarration(blogId);

    // Cache hit: the audio already exists → free replay, no budget spent.
    if (prep.cached) {
      const state = await this.billing.narrationRemaining(userId);
      return { url: prep.url, cached: true, pro: state.pro, remaining: state.remaining };
    }

    // Cache miss: enforce the character budget BEFORE spending provider credits,
    // then generate and bill the exact characters we sent to the provider.
    const gate = await this.billing.assertNarrationAllowed(userId, prep.chars);
    await this.tts.generateNarration(prep.key, prep.text);
    const after = await this.billing.recordNarrationChars(userId, prep.chars);
    return { url: prep.url, cached: false, pro: gate.pro, remaining: after.remaining };
  }
}

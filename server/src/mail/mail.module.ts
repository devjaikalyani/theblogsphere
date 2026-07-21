import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { NotifyService } from './notify.service';
import { DigestService } from './digest.service';
import { NotificationController } from './notification.controller';
import { DigestController } from './digest.controller';

/** Global (like PrismaModule) so any feature module can inject MailService /
 *  NotifyService without an explicit import; email is cross-cutting plumbing. */
@Global()
@Module({
  controllers: [NotificationController, DigestController],
  providers: [MailService, NotifyService, DigestService],
  exports: [MailService, NotifyService],
})
export class MailModule {}

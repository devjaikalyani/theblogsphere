import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { NotifyService } from './notify.service';
import { NotificationController } from './notification.controller';

/** Global (like PrismaModule) so any feature module can inject MailService /
 *  NotifyService without an explicit import; email is cross-cutting plumbing. */
@Global()
@Module({
  controllers: [NotificationController],
  providers: [MailService, NotifyService],
  exports: [MailService, NotifyService],
})
export class MailModule {}

import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { BlogModule } from '../blog/blog.module';
import { UploadModule } from '../upload/upload.module';

@Module({
  imports: [BlogModule, UploadModule],
  controllers: [UserController],
})
export class UserModule {}

import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { BlogModule } from '../blog/blog.module';

@Module({
  imports: [BlogModule],
  controllers: [UserController],
})
export class UserModule {}

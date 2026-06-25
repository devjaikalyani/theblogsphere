import { Module } from '@nestjs/common';
import { FollowController } from './follow.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({ imports: [PrismaModule], controllers: [FollowController] })
export class FollowModule {}

import { Module } from '@nestjs/common';
import { LikeController } from './like.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({ imports: [PrismaModule], controllers: [LikeController] })
export class LikeModule {}

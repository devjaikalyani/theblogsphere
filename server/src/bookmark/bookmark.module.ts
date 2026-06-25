import { Module } from '@nestjs/common';
import { BookmarkController } from './bookmark.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({ imports: [PrismaModule], controllers: [BookmarkController] })
export class BookmarkModule {}

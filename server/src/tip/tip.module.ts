import { Module } from '@nestjs/common';
import { TipController } from './tip.controller';

@Module({
  controllers: [TipController],
})
export class TipModule {}

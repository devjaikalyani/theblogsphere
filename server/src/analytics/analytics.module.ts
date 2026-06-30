import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { BillingModule } from '../billing/billing.module';

@Module({ imports: [PrismaModule, BillingModule], controllers: [AnalyticsController] })
export class AnalyticsModule {}

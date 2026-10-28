import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from '../prisma/prisma.module.js';
import { UsageRepository } from './repositories/usage.repository.js';
import { RecordUsageUseCase } from './use-cases/record-usage.use-case.js';
import { UsageController } from './usage.controller.js';
import { getUsageRateLimit, USAGE_THROTTLER_NAME } from './usage-rate-limit.js';
import { UsageService } from './usage.service.js';

@Module({
  imports: [
    PrismaModule,
    ThrottlerModule.forRootAsync({
      useFactory: () => {
        const { limit, ttl } = getUsageRateLimit();

        return {
          throttlers: [
            {
              name: USAGE_THROTTLER_NAME,
              limit,
              ttl,
            },
          ],
        };
      },
    }),
  ],
  controllers: [UsageController],
  providers: [UsageService, RecordUsageUseCase, UsageRepository],
})
export class UsageModule {}

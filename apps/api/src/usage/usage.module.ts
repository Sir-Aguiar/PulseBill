import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { UsageRepository } from './repositories/usage.repository.js';
import { RecordUsageUseCase } from './use-cases/record-usage.use-case.js';
import { UsageController } from './usage.controller.js';
import { UsageService } from './usage.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [UsageController],
  providers: [UsageService, RecordUsageUseCase, UsageRepository],
})
export class UsageModule {}

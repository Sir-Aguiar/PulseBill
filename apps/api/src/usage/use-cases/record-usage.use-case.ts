import { Injectable } from '@nestjs/common';
import type { RecordUsageDto } from '../dto/record-usage.dto.js';
import {
  UsageRepository,
  type RecordedUsage,
} from '../repositories/usage.repository.js';

@Injectable()
export class RecordUsageUseCase {
  constructor(private readonly usageRepository: UsageRepository) {}

  execute(dto: RecordUsageDto): Promise<RecordedUsage> {
    return this.usageRepository.create(dto);
  }
}

import { Injectable } from '@nestjs/common';
import type { RecordUsageDto } from './dto/record-usage.dto.js';
import { RecordUsageUseCase } from './use-cases/record-usage.use-case.js';

@Injectable()
export class UsageService {
  constructor(private readonly recordUsageUseCase: RecordUsageUseCase) {}

  record(dto: RecordUsageDto) {
    return this.recordUsageUseCase.execute(dto);
  }
}

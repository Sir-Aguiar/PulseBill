import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ZodError } from 'zod';
import { Public } from '../common/decorators/public.decorator.js';
import { recordUsageSchema } from './schemas/record-usage.schema.js';
import { getUsageRateLimit, USAGE_THROTTLER_NAME } from './usage-rate-limit.js';
import { UsageService } from './usage.service.js';

@Controller('v1/usage')
export class UsageController {
  constructor(private readonly usageService: UsageService) {}

  @Public()
  @Post()
  @UseGuards(ThrottlerGuard)
  @Throttle({
    [USAGE_THROTTLER_NAME]: {
      limit: () => getUsageRateLimit().limit,
      ttl: () => getUsageRateLimit().ttl,
    },
  })
  @HttpCode(HttpStatus.CREATED)
  record(@Body() body: unknown) {
    const dto = this.parseBody(body);
    return this.usageService.record(dto);
  }

  private parseBody(body: unknown) {
    try {
      return recordUsageSchema.parse(body);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new BadRequestException(this.validationMessage(error));
      }

      throw error;
    }
  }

  private validationMessage(error: ZodError): string {
    return error.issues
      .map((issue) => {
        const field = issue.path.join('.') || 'body';
        return `${field}: ${issue.message}`;
      })
      .join('; ');
  }
}

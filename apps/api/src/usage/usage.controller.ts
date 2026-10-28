import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
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
  @ApiCreatedResponse({
    description: 'Usage event recorded',
    schema: {
      type: 'object',
      required: [
        'id',
        'customerId',
        'metric',
        'quantity',
        'idempotencyKey',
        'recordedAt',
        'receivedAt',
      ],
      properties: {
        id: { type: 'string', format: 'uuid' },
        customerId: { type: 'string', format: 'uuid' },
        metric: {
          type: 'string',
          enum: ['API_CALLS', 'TOKENS', 'STORAGE_GB'],
        },
        quantity: { type: 'string' },
        idempotencyKey: { type: 'string' },
        recordedAt: { type: 'string', format: 'date-time' },
        receivedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid usage payload or missing related record',
    schema: {
      type: 'object',
      required: ['statusCode', 'message'],
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: { type: 'string' },
      },
    },
  })
  @ApiTooManyRequestsResponse({
    description: 'Usage rate limit exceeded',
    schema: {
      type: 'object',
      required: ['statusCode', 'message'],
      properties: {
        statusCode: { type: 'number', example: 429 },
        message: { type: 'string' },
      },
    },
  })
  record(@Body({ schema: recordUsageSchema }) body: unknown) {
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

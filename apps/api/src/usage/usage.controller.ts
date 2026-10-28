import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { ZodError } from 'zod';
import { Public } from '../common/decorators/public.decorator.js';
import { recordUsageSchema } from './schemas/record-usage.schema.js';
import { UsageService } from './usage.service.js';

@Controller('v1/usage')
export class UsageController {
  constructor(private readonly usageService: UsageService) {}

  @Public()
  @Post()
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

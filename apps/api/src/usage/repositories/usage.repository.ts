import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client.js';
import { ApplicationError } from '../../common/errors/application.error.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { RecordUsageDto } from '../dto/record-usage.dto.js';

export type RecordedUsage = {
  id: string;
  customerId: string;
  metric: RecordUsageDto['metric'];
  quantity: string;
  idempotencyKey: string;
  recordedAt: string;
  receivedAt: string;
};

@Injectable()
export class UsageRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: RecordUsageDto): Promise<RecordedUsage> {
    try {
      const created = await this.prisma.usageLog.create({
        data: {
          customerId: input.customerId,
          metric: input.metric,
          quantity: input.quantity,
          idempotencyKey: input.idempotencyKey,
          recordedAt: new Date(input.recordedAt),
        },
        select: {
          id: true,
          customerId: true,
          metric: true,
          quantity: true,
          idempotencyKey: true,
          recordedAt: true,
          receivedAt: true,
        },
      });

      return {
        id: created.id,
        customerId: created.customerId,
        metric: created.metric,
        quantity: created.quantity.toString(),
        idempotencyKey: created.idempotencyKey,
        recordedAt: created.recordedAt.toISOString(),
        receivedAt: created.receivedAt.toISOString(),
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new ApplicationError(
          ApplicationError.prismaErrorToHttpStatus(error.code),
          this.prismaErrorMessage(error),
          error,
        );
      }

      throw error;
    }
  }

  private prismaErrorMessage(
    error: Prisma.PrismaClientKnownRequestError,
  ): string {
    const field = this.fieldFromMeta(error.meta);

    switch (error.code) {
      case 'P2000':
        return field ? `${field} is too long` : 'Value is too long';
      case 'P2002':
        return field ? `${field} already exists` : 'Value already exists';
      case 'P2003':
        return field
          ? `${field} does not exist`
          : 'Related record does not exist';
      case 'P2001':
      case 'P2025':
        return field ? `${field} was not found` : 'Record not found';
      case 'P2005':
      case 'P2006':
        return field ? `${field} has an invalid type` : 'Invalid type';
      case 'P2004':
        return field ? `${field} violates a constraint` : 'Constraint violated';
      default:
        return 'Unexpected database error';
    }
  }

  private fieldFromMeta(meta: unknown): string | undefined {
    if (typeof meta !== 'object' || meta === null) {
      return undefined;
    }

    const record = meta as Record<string, unknown>;
    const target = record.target;

    if (Array.isArray(target)) {
      const fields = target.filter(
        (item): item is string => typeof item === 'string',
      );

      if (fields.length > 0) {
        return fields.join(' and ');
      }
    }

    if (typeof target === 'string' && target.length > 0) {
      return target;
    }

    if (typeof record.field_name === 'string' && record.field_name.length > 0) {
      return record.field_name;
    }

    return undefined;
  }
}

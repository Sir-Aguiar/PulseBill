import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client.js';
import { ApplicationError } from '../../common/errors/application.error.js';
import { PrismaService } from '../../prisma/prisma.service.js';

export type StoredPaymentWebhook = {
  id: string;
  status: 'RECEIVED' | 'PROCESSED' | 'IGNORED' | 'FAILED';
};

type RecordPaymentWebhookInput = {
  provider: string;
  externalEventId: string;
  rawPayload: Prisma.InputJsonValue;
  signatureHash: string;
};

@Injectable()
export class PaymentWebhookRepository {
  constructor(private readonly prisma: PrismaService) {}

  async record(
    input: RecordPaymentWebhookInput,
  ): Promise<StoredPaymentWebhook> {
    try {
      return await this.prisma.paymentWebhookLog.create({
        data: {
          provider: input.provider,
          externalEventId: input.externalEventId,
          status: 'RECEIVED',
          rawPayload: input.rawPayload,
          signatureHash: input.signatureHash,
        },
        select: {
          id: true,
          status: true,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existing = await this.prisma.paymentWebhookLog.findUnique({
          where: {
            provider_externalEventId: {
              provider: input.provider,
              externalEventId: input.externalEventId,
            },
          },
          select: {
            id: true,
            status: true,
          },
        });

        if (existing) {
          return existing;
        }
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new ApplicationError(
          ApplicationError.prismaErrorToHttpStatus(error.code),
          'Could not store the payment webhook',
          error,
        );
      }

      throw error;
    }
  }
}

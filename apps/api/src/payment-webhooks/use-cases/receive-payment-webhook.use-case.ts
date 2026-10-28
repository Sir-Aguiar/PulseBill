import { Injectable } from '@nestjs/common';
import type { ReceivePaymentWebhookDto } from '../dto/receive-payment-webhook.dto.js';
import {
  PaymentWebhookRepository,
  type StoredPaymentWebhook,
} from '../repositories/payment-webhook.repository.js';

@Injectable()
export class ReceivePaymentWebhookUseCase {
  constructor(private readonly paymentWebhooks: PaymentWebhookRepository) {}

  execute(
    dto: ReceivePaymentWebhookDto,
    signatureHash: string,
  ): Promise<StoredPaymentWebhook> {
    return this.paymentWebhooks.record({
      provider: dto.provider,
      externalEventId: dto.externalEventId,
      rawPayload: dto,
      signatureHash,
    });
  }
}

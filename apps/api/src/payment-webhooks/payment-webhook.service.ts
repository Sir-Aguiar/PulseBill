import { Injectable } from '@nestjs/common';
import type { ReceivePaymentWebhookDto } from './dto/receive-payment-webhook.dto.js';
import { ReceivePaymentWebhookUseCase } from './use-cases/receive-payment-webhook.use-case.js';

@Injectable()
export class PaymentWebhookService {
  constructor(
    private readonly receivePaymentWebhook: ReceivePaymentWebhookUseCase,
  ) {}

  receive(dto: ReceivePaymentWebhookDto, signatureHash: string) {
    return this.receivePaymentWebhook.execute(dto, signatureHash);
  }
}

import { Module } from '@nestjs/common';
import { EnvService } from '../config/env.service.js';
import { WebhookSignatureGuard } from '../common/guards/webhook-signature.guard.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { PaymentWebhookController } from './payment-webhook.controller.js';
import { PaymentWebhookService } from './payment-webhook.service.js';
import { PaymentWebhookRepository } from './repositories/payment-webhook.repository.js';
import { ReceivePaymentWebhookUseCase } from './use-cases/receive-payment-webhook.use-case.js';

@Module({
  imports: [PrismaModule],
  controllers: [PaymentWebhookController],
  providers: [
    EnvService,
    WebhookSignatureGuard,
    PaymentWebhookRepository,
    ReceivePaymentWebhookUseCase,
    PaymentWebhookService,
  ],
})
export class PaymentWebhookModule {}

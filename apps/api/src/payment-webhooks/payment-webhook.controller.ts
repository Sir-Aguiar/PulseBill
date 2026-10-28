import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../common/decorators/public.decorator.js';
import {
  WEBHOOK_SIGNATURE_HEADER,
  WebhookSignatureGuard,
} from '../common/guards/webhook-signature.guard.js';
import { PaymentWebhookService } from './payment-webhook.service.js';
import { receivePaymentWebhookSchema } from './schemas/receive-payment-webhook.schema.js';

@Controller('v1/webhooks')
export class PaymentWebhookController {
  constructor(private readonly paymentWebhooks: PaymentWebhookService) {}

  @Public()
  @UseGuards(WebhookSignatureGuard)
  @Post('payment')
  @HttpCode(200)
  receive(@Req() request: RawBodyRequest<Request>, @Body() body: unknown) {
    const dto = receivePaymentWebhookSchema.parse(body);
    const signature = request.header(WEBHOOK_SIGNATURE_HEADER) ?? '';

    return this.paymentWebhooks.receive(dto, signature);
  }
}

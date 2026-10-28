import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthenticationGuard } from './common/guards/authentication.guard.js';
import { EnvService } from './config/env.service.js';
import { PaymentWebhookModule } from './payment-webhooks/payment-webhook.module.js';

@Module({
  imports: [PaymentWebhookModule],
  controllers: [],
  providers: [
    EnvService,
    {
      provide: APP_GUARD,
      useClass: AuthenticationGuard,
    },
  ],
})
export class AppModule {}

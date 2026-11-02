import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthenticationGuard } from './common/guards/authentication.guard.js';
import { EnvService } from './config/env.service.js';
import { EXCHANGE_RATE_CLIENT } from './exchange-rates/exchange-rate.client.js';
import { ExchangeRateService } from './exchange-rates/exchange-rate.service.js';
import { HttpExchangeRateClient } from './exchange-rates/http-exchange-rate.client.js';

@Module({
  imports: [],
  controllers: [],
  providers: [
    EnvService,
    HttpExchangeRateClient,
    {
      provide: EXCHANGE_RATE_CLIENT,
      useExisting: HttpExchangeRateClient,
    },
    ExchangeRateService,
    {
      provide: APP_GUARD,
      useClass: AuthenticationGuard,
    },
  ],
})
export class AppModule {}

import { Inject, Injectable } from '@nestjs/common';
import { ApplicationError } from '../common/errors/application.error.js';
import { EnvService } from '../config/env.service.js';
import {
  EXCHANGE_RATE_CLIENT,
  exchangeRatesSchema,
  type ExchangeRateClient,
  type ExchangeRates,
} from './exchange-rate.client.js';

@Injectable()
export class ExchangeRateService {
  private lastRates: ExchangeRates | null = null;

  constructor(
    private readonly env: EnvService,
    @Inject(EXCHANGE_RATE_CLIENT)
    private readonly client: ExchangeRateClient,
  ) {}

  async getUsdRates(): Promise<ExchangeRates> {
    const attempts = this.env.get('EXCHANGE_RATE_MAX_ATTEMPTS');
    const timeoutMs = this.env.get('EXCHANGE_RATE_TIMEOUT_MS');
    const url = this.env.get('EXCHANGE_RATE_URL');
    let lastError: unknown;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const rates = exchangeRatesSchema.parse(
          await this.client.fetchRates({ url, timeoutMs }),
        );
        this.lastRates = rates;
        return { ...rates };
      } catch (error) {
        lastError = error;
      }
    }

    if (this.lastRates) {
      return { ...this.lastRates };
    }

    throw new ApplicationError(
      503,
      'Exchange rates are unavailable',
      lastError,
    );
  }
}

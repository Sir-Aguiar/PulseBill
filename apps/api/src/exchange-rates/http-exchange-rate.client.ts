import { Injectable } from '@nestjs/common';
import {
  exchangeRateResponseSchema,
  type ExchangeRateClient,
  type ExchangeRateRequest,
  type ExchangeRates,
} from './exchange-rate.client.js';

@Injectable()
export class HttpExchangeRateClient implements ExchangeRateClient {
  async fetchRates(request: ExchangeRateRequest): Promise<ExchangeRates> {
    const response = await fetch(request.url, {
      signal: AbortSignal.timeout(request.timeoutMs),
    });

    if (!response.ok) {
      throw new Error(
        `Exchange rate request failed with status ${response.status}`,
      );
    }

    const parsed = exchangeRateResponseSchema.safeParse(await response.json());

    if (!parsed.success) {
      throw new Error('Exchange rate response is invalid');
    }

    return {
      brl: parsed.data.rates.BRL,
      eur: parsed.data.rates.EUR,
    };
  }
}

import { describe, expect, it } from 'vitest';
import { ApplicationError } from '../common/errors/application.error.js';
import { EnvService } from '../config/env.service.js';
import {
  type ExchangeRateClient,
  type ExchangeRateRequest,
  type ExchangeRates,
} from './exchange-rate.client.js';
import { ExchangeRateService } from './exchange-rate.service.js';

class FakeExchangeRateClient implements ExchangeRateClient {
  readonly calls: ExchangeRateRequest[] = [];

  constructor(private readonly results: Array<ExchangeRates | Error>) {}

  async fetchRates(request: ExchangeRateRequest): Promise<ExchangeRates> {
    this.calls.push(request);
    const next = this.results.shift();

    if (next instanceof Error) {
      throw next;
    }

    if (!next) {
      throw new Error('missing fake exchange rate');
    }

    return next;
  }
}

function envWithAttempts(attempts: number): EnvService {
  return {
    get(key: string) {
      if (key === 'EXCHANGE_RATE_MAX_ATTEMPTS') {
        return attempts;
      }
      if (key === 'EXCHANGE_RATE_TIMEOUT_MS') {
        return 25;
      }
      if (key === 'EXCHANGE_RATE_URL') {
        return 'https://rates.test/latest';
      }
      throw new Error(`unexpected env key ${key}`);
    },
  } as EnvService;
}

const quote = { brl: 5.25, eur: 0.91 };

describe('ExchangeRateService', () => {
  it('returns positive BRL and EUR rates from a valid response', async () => {
    const client = new FakeExchangeRateClient([quote]);
    const service = new ExchangeRateService(envWithAttempts(3), client);

    await expect(service.getUsdRates()).resolves.toEqual(quote);
    expect(client.calls).toHaveLength(1);
    expect(client.calls[0]?.timeoutMs).toBe(25);
  });

  it('retries a timeout and then returns the successful quote', async () => {
    const client = new FakeExchangeRateClient([
      new DOMException(
        'The operation was aborted due to timeout',
        'TimeoutError',
      ),
      quote,
    ]);
    const service = new ExchangeRateService(envWithAttempts(2), client);

    await expect(service.getUsdRates()).resolves.toEqual(quote);
    expect(client.calls).toHaveLength(2);
  });

  it('reuses the last successful quote after later attempts fail', async () => {
    const client = new FakeExchangeRateClient([
      quote,
      new Error('socket hang up'),
      new Error('socket hang up'),
    ]);
    const service = new ExchangeRateService(envWithAttempts(2), client);

    await expect(service.getUsdRates()).resolves.toEqual(quote);
    await expect(service.getUsdRates()).resolves.toEqual(quote);
    expect(client.calls).toHaveLength(3);
  });

  it('fails when every attempt fails and no previous quote exists', async () => {
    const client = new FakeExchangeRateClient([
      new Error('connect ECONNREFUSED'),
      new Error('connect ECONNREFUSED'),
    ]);
    const service = new ExchangeRateService(envWithAttempts(2), client);

    await expect(service.getUsdRates()).rejects.toEqual(
      expect.objectContaining({
        name: ApplicationError.name,
        status: 503,
        message: 'Exchange rates are unavailable',
      }),
    );
    expect(client.calls).toHaveLength(2);
  });
});

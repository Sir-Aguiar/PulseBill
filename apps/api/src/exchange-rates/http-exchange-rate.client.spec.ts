import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpExchangeRateClient } from './http-exchange-rate.client.js';

describe('HttpExchangeRateClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns positive BRL and EUR rates from a fake response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ rates: { BRL: 5.1, EUR: 0.92 } }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const client = new HttpExchangeRateClient();

    await expect(
      client.fetchRates({ url: 'https://rates.test/latest', timeoutMs: 50 }),
    ).resolves.toEqual({ brl: 5.1, eur: 0.92 });
    expect(fetchMock).toHaveBeenCalledWith('https://rates.test/latest', {
      signal: expect.any(AbortSignal),
    });
  });

  it('rejects a failed response so the caller can retry', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({}),
      }),
    );
    const client = new HttpExchangeRateClient();

    await expect(
      client.fetchRates({ url: 'https://rates.test/latest', timeoutMs: 50 }),
    ).rejects.toThrow('status 503');
  });
});

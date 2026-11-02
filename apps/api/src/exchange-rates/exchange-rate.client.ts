import { z } from 'zod';

export const exchangeRatesSchema = z.object({
  brl: z.number().finite().positive(),
  eur: z.number().finite().positive(),
});

export type ExchangeRates = z.infer<typeof exchangeRatesSchema>;

export const exchangeRateResponseSchema = z.object({
  rates: z.object({
    BRL: z.number().finite().positive(),
    EUR: z.number().finite().positive(),
  }),
});

export type ExchangeRateRequest = {
  url: string;
  timeoutMs: number;
};

export interface ExchangeRateClient {
  fetchRates(request: ExchangeRateRequest): Promise<ExchangeRates>;
}

export const EXCHANGE_RATE_CLIENT = Symbol('EXCHANGE_RATE_CLIENT');

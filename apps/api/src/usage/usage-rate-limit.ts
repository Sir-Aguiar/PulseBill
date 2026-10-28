import { EnvService } from '../config/env.service.js';

export const USAGE_THROTTLER_NAME = 'usage';

type UsageRateLimit = {
  limit: number;
  ttl: number;
};

let cached: UsageRateLimit | undefined;

export const getUsageRateLimit = (): UsageRateLimit => {
  if (!cached) {
    const env = new EnvService();
    cached = {
      limit: env.get('USAGE_RATE_LIMIT_MAX'),
      ttl: env.get('USAGE_RATE_LIMIT_TTL_MS'),
    };
  }

  return cached;
};

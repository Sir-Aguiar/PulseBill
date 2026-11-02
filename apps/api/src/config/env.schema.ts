import { z } from 'zod';

export const envSchema = z.object({
  POSTGRES_USER: z.string().min(1, 'POSTGRES_USER is required'),
  POSTGRES_PASSWORD: z.string().min(1, 'POSTGRES_PASSWORD is required'),
  POSTGRES_DB: z.string().min(1, 'POSTGRES_DB is required'),
  POSTGRES_PORT: z.coerce.number().int().positive(),
  POSTGRES_HOST: z.string().min(1, 'POSTGRES_HOST is required'),
  POSTGRES_SCHEMA: z.string().min(1, 'POSTGRES_SCHEMA is required'),
  API_PORT: z.coerce.number().int().positive(),
  DATABASE_URL: z.url('DATABASE_URL must be a URL'),
  EXCHANGE_RATE_URL: z.url('EXCHANGE_RATE_URL must be a URL'),
  EXCHANGE_RATE_TIMEOUT_MS: z.coerce.number().int().positive(),
  EXCHANGE_RATE_MAX_ATTEMPTS: z.coerce.number().int().positive(),
});

export type Env = z.infer<typeof envSchema>;

export const validateEnv = (config: Record<string, unknown>): Env => {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${formatted}`);
  }

  return result.data;
};

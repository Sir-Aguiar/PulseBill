import { z } from 'zod';

export const recordUsageSchema = z.object({
  customerId: z
    .string('customerId must be a UUID')
    .uuid('customerId must be a UUID'),
  metric: z.enum(['API_CALLS', 'TOKENS', 'STORAGE_GB'], {
    error: 'metric must be API_CALLS, TOKENS, or STORAGE_GB',
  }),
  quantity: z
    .number('quantity must be a positive decimal')
    .finite('quantity must be a positive decimal')
    .positive('quantity must be a positive decimal'),
  idempotencyKey: z
    .string('idempotencyKey must be a non-empty string')
    .min(1, 'idempotencyKey must be a non-empty string'),
  recordedAt: z.string('recordedAt must be an ISO datetime').datetime({
    offset: true,
    message: 'recordedAt must be an ISO datetime',
  }),
});

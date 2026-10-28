import { z } from 'zod';

export const receivePaymentWebhookSchema = z
  .object({
    provider: z.string().min(1, 'provider is required'),
    externalEventId: z.string().min(1, 'externalEventId is required'),
  })
  .passthrough();

export type ReceivePaymentWebhookDto = z.infer<
  typeof receivePaymentWebhookSchema
>;

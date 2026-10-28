import type { z } from 'zod';
import { recordUsageSchema } from '../schemas/record-usage.schema.js';

export type RecordUsageDto = z.infer<typeof recordUsageSchema>;

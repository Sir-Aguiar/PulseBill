import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Metric, PrismaClient } from '../generated/prisma/client.ts';

const USAGE_LOG_COUNT = 10_000;
const BATCH_SIZE = 1_000;
const SEED_EMAIL = 'seed@pulsebill.local';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg(databaseUrl),
});

const metrics = [Metric.API_CALLS, Metric.TOKENS, Metric.STORAGE_GB] as const;

async function main(): Promise<void> {
  const customer = await prisma.customer.upsert({
    where: { email: SEED_EMAIL },
    update: {},
    create: {
      name: 'Seed Customer',
      legalName: 'Seed Customer Ltd',
      email: SEED_EMAIL,
      currency: 'USD',
    },
  });

  await prisma.usageLog.deleteMany({
    where: {
      customerId: customer.id,
      idempotencyKey: { startsWith: 'seed-' },
    },
  });

  const recordedAtOrigin = Date.now();

  for (let offset = 0; offset < USAGE_LOG_COUNT; offset += BATCH_SIZE) {
    const size = Math.min(BATCH_SIZE, USAGE_LOG_COUNT - offset);

    await prisma.usageLog.createMany({
      data: Array.from({ length: size }, (_, index) => {
        const sequence = offset + index;

        return {
          customerId: customer.id,
          metric: metrics[sequence % metrics.length],
          quantity: ((sequence % 1_000) + 1).toFixed(4),
          idempotencyKey: `seed-${sequence}`,
          recordedAt: new Date(recordedAtOrigin - sequence * 60_000),
        };
      }),
    });
  }

  const count = await prisma.usageLog.count({
    where: {
      customerId: customer.id,
      idempotencyKey: { startsWith: 'seed-' },
    },
  });

  console.log(`UsageLog seed rows: ${count}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

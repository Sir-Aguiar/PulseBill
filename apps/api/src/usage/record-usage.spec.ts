import { Controller, Get, INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '../../generated/prisma/client.js';
import { Public } from '../common/decorators/public.decorator.js';
import { ApplicationErrorFilter } from '../common/filters/application-error.filter.js';
import { AuthenticationGuard } from '../common/guards/authentication.guard.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { UsageModule } from './usage.module.js';

const usageRateLimitMax = 3;
const usageRateLimitTtlMs = 60000;

process.env.USAGE_RATE_LIMIT_MAX = String(usageRateLimitMax);
process.env.USAGE_RATE_LIMIT_TTL_MS = String(usageRateLimitTtlMs);

@Public()
@Controller('probe')
class UnthrottledController {
  @Get()
  index(): string {
    return 'ok';
  }
}

const customerId = '11111111-1111-4111-8111-111111111111';
const missingCustomerId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const validBody = {
  customerId,
  metric: 'API_CALLS',
  quantity: 1.5,
  idempotencyKey: 'evt-1',
  recordedAt: '2026-10-28T14:00:00.000Z',
};

type CreateArgs = {
  data: {
    customerId: string;
    metric: string;
    quantity: number;
    idempotencyKey: string;
    recordedAt: Date;
  };
};

describe('POST /v1/usage', () => {
  let app: INestApplication<App>;
  let inserted: Set<string>;
  const rollup = {
    create: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
  };
  const usageLog = {
    create: vi.fn(async (args: CreateArgs) => {
      if (args.data.customerId === missingCustomerId) {
        throw new Prisma.PrismaClientKnownRequestError(
          'Foreign key constraint failed',
          {
            code: 'P2003',
            clientVersion: '7.10.1',
            meta: { field_name: 'customerId' },
          },
        );
      }

      const identity = `${args.data.customerId}\0${args.data.idempotencyKey}`;

      if (inserted.has(identity)) {
        throw new Prisma.PrismaClientKnownRequestError(
          'Unique constraint failed',
          {
            code: 'P2002',
            clientVersion: '7.10.1',
            meta: { target: ['customerId', 'idempotencyKey'] },
          },
        );
      }

      inserted.add(identity);

      return {
        id: '22222222-2222-4222-8222-222222222222',
        customerId: args.data.customerId,
        metric: args.data.metric,
        quantity: {
          toString: () => args.data.quantity.toString(),
        },
        idempotencyKey: args.data.idempotencyKey,
        recordedAt: args.data.recordedAt,
        receivedAt: new Date('2026-10-28T14:00:01.000Z'),
      };
    }),
  };

  beforeEach(async () => {
    inserted = new Set();
    usageLog.create.mockClear();
    rollup.create.mockClear();
    rollup.update.mockClear();
    rollup.upsert.mockClear();

    const moduleRef = await Test.createTestingModule({
      imports: [UsageModule],
      controllers: [UnthrottledController],
      providers: [
        {
          provide: APP_GUARD,
          useClass: AuthenticationGuard,
        },
      ],
    })
      .overrideProvider(PrismaService)
      .useValue({
        usageLog,
        usageDailyRollup: rollup,
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new ApplicationErrorFilter());
    await app.init();
  });

  afterEach(async () => {
    await app?.close();
  });

  it('persists a usage log and leaves the daily rollup untouched', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/usage')
      .send(validBody);

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      id: '22222222-2222-4222-8222-222222222222',
      customerId,
      metric: 'API_CALLS',
      quantity: '1.5',
      idempotencyKey: 'evt-1',
      recordedAt: '2026-10-28T14:00:00.000Z',
      receivedAt: '2026-10-28T14:00:01.000Z',
    });
    expect(inserted.size).toBe(1);
    expect(usageLog.create).toHaveBeenCalledOnce();
    expect(rollup.create).not.toHaveBeenCalled();
    expect(rollup.update).not.toHaveBeenCalled();
    expect(rollup.upsert).not.toHaveBeenCalled();
  });

  it('rejects an invalid body before it reaches the database', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/usage')
      .send({
        ...validBody,
        quantity: -1,
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('quantity');
    expect(usageLog.create).not.toHaveBeenCalled();
    expect(inserted.size).toBe(0);
  });

  it('returns 409 when the same customer and idempotency key is replayed', async () => {
    const first = await request(app.getHttpServer())
      .post('/v1/usage')
      .send(validBody);
    const replay = await request(app.getHttpServer())
      .post('/v1/usage')
      .send(validBody);

    expect(first.status).toBe(201);
    expect(replay.status).toBe(409);
    expect(replay.body).toEqual({
      statusCode: 409,
      message: 'customerId and idempotencyKey already exists',
    });
    expect(inserted.size).toBe(1);
    expect(usageLog.create).toHaveBeenCalledTimes(2);
    expect(rollup.create).not.toHaveBeenCalled();
    expect(rollup.update).not.toHaveBeenCalled();
    expect(rollup.upsert).not.toHaveBeenCalled();
  });

  it('returns 400 when the customer does not exist', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/usage')
      .send({
        ...validBody,
        customerId: missingCustomerId,
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      statusCode: 400,
      message: 'customerId does not exist',
    });
    expect(inserted.size).toBe(0);
    expect(rollup.upsert).not.toHaveBeenCalled();
  });

  it('records a short burst and rejects the request past the limit', async () => {
    for (let index = 0; index < usageRateLimitMax; index += 1) {
      const response = await request(app.getHttpServer())
        .post('/v1/usage')
        .send({
          ...validBody,
          idempotencyKey: `burst-${index}`,
        });

      expect(response.status).toBe(201);
    }

    const blocked = await request(app.getHttpServer())
      .post('/v1/usage')
      .send({
        ...validBody,
        idempotencyKey: 'burst-over',
      });

    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({
      statusCode: 429,
      message: 'ThrottlerException: Too Many Requests',
    });
    expect(usageLog.create).toHaveBeenCalledTimes(usageRateLimitMax);
    expect(inserted.size).toBe(usageRateLimitMax);
  });

  it('does not rate limit routes outside POST /v1/usage', async () => {
    for (let index = 0; index < usageRateLimitMax + 2; index += 1) {
      const response = await request(app.getHttpServer()).get('/probe');

      expect(response.status).toBe(200);
      expect(response.text).toBe('ok');
    }

    expect(usageLog.create).not.toHaveBeenCalled();
  });
});

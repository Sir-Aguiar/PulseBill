import { createHmac } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '../../generated/prisma/client.js';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { EnvService } from '../config/env.service.js';
import { WEBHOOK_SIGNATURE_HEADER } from '../common/guards/webhook-signature.guard.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PaymentWebhookModule } from './payment-webhook.module.js';
import { PaymentWebhookRepository } from './repositories/payment-webhook.repository.js';
import { ReceivePaymentWebhookUseCase } from './use-cases/receive-payment-webhook.use-case.js';

const secret = 'test-webhook-secret';
const payload = {
  provider: 'stripe',
  externalEventId: 'evt_1',
  amount: '10.00',
};

function sign(body: string): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

describe('POST /v1/webhooks/payment', () => {
  it('does not store a webhook when the signature is invalid', async () => {
    const record = vi.fn();
    const app = await createApp(record);

    await request(app.getHttpServer())
      .post('/v1/webhooks/payment')
      .set(WEBHOOK_SIGNATURE_HEADER, 'deadbeef')
      .send(payload)
      .expect(401);

    expect(record).not.toHaveBeenCalled();
    await app.close();
  });

  it('stores the first delivery and reuses that row on replay', async () => {
    const stored = { id: 'log-1', status: 'RECEIVED' as const };
    const record = vi
      .fn()
      .mockResolvedValueOnce(stored)
      .mockResolvedValueOnce(stored);
    const app = await createApp(record);
    const body = JSON.stringify(payload);
    const signature = sign(body);

    const first = await request(app.getHttpServer())
      .post('/v1/webhooks/payment')
      .set('content-type', 'application/json')
      .set(WEBHOOK_SIGNATURE_HEADER, signature)
      .send(body)
      .expect(200);
    const second = await request(app.getHttpServer())
      .post('/v1/webhooks/payment')
      .set('content-type', 'application/json')
      .set(WEBHOOK_SIGNATURE_HEADER, signature)
      .send(body)
      .expect(200);

    expect(first.body).toEqual(stored);
    expect(second.body).toEqual(stored);
    expect(record).toHaveBeenCalledTimes(2);
    expect(record).toHaveBeenNthCalledWith(1, {
      provider: 'stripe',
      externalEventId: 'evt_1',
      rawPayload: payload,
      signatureHash: signature,
    });
    await app.close();
  });
});

describe('PaymentWebhookRepository', () => {
  it('returns the existing row when the provider event was already stored', async () => {
    const existing = { id: 'log-1', status: 'RECEIVED' as const };
    const duplicate = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed',
      { code: 'P2002', clientVersion: '7.10.1' },
    );
    const prisma = {
      paymentWebhookLog: {
        create: vi.fn().mockRejectedValue(duplicate),
        findUnique: vi.fn().mockResolvedValue(existing),
      },
    };
    const repository = new PaymentWebhookRepository(
      prisma as unknown as ConstructorParameters<
        typeof PaymentWebhookRepository
      >[0],
    );

    await expect(
      repository.record({
        provider: 'stripe',
        externalEventId: 'evt_1',
        rawPayload: payload,
        signatureHash: 'abc',
      }),
    ).resolves.toEqual(existing);
    expect(prisma.paymentWebhookLog.create).toHaveBeenCalledTimes(1);
    expect(prisma.paymentWebhookLog.findUnique).toHaveBeenCalledTimes(1);
  });
});

describe('ReceivePaymentWebhookUseCase', () => {
  it('asks the repository to record the signed payload once per call', async () => {
    const record = vi.fn().mockResolvedValue({
      id: 'log-1',
      status: 'RECEIVED',
    });
    const useCase = new ReceivePaymentWebhookUseCase({
      record,
    } as unknown as PaymentWebhookRepository);

    await expect(useCase.execute(payload, 'abc')).resolves.toEqual({
      id: 'log-1',
      status: 'RECEIVED',
    });
    expect(record).toHaveBeenCalledOnce();
  });
});

async function createApp(
  record: ReturnType<typeof vi.fn>,
): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [PaymentWebhookModule],
  })
    .overrideProvider(PrismaService)
    .useValue({})
    .overrideProvider(EnvService)
    .useValue({
      get: (key: string) => {
        if (key === 'WEBHOOK_SIGNING_SECRET') {
          return secret;
        }
        throw new Error(`unexpected env key ${key}`);
      },
    })
    .overrideProvider(PaymentWebhookRepository)
    .useValue({ record })
    .compile();

  const app = moduleRef.createNestApplication({ rawBody: true });
  await app.init();
  return app;
}

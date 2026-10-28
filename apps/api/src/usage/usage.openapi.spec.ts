import { Controller, Get, type INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterEach, describe, expect, it } from 'vitest';
import { AuthenticationGuard } from '../common/guards/authentication.guard.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  createOpenApiDocument,
  setupSwagger,
  SWAGGER_PATH,
} from '../swagger.js';
import { UsageModule } from './usage.module.js';

process.env.USAGE_RATE_LIMIT_MAX ??= '3';
process.env.USAGE_RATE_LIMIT_TTL_MS ??= '60000';

@Controller('closed')
class ClosedController {
  @Get()
  index(): string {
    return 'closed';
  }
}

describe('POST /v1/usage OpenAPI document', () => {
  let app: INestApplication<App>;

  afterEach(async () => {
    await app?.close();
  });

  async function initApp(): Promise<void> {
    const moduleRef = await Test.createTestingModule({
      imports: [UsageModule],
      controllers: [ClosedController],
      providers: [
        {
          provide: APP_GUARD,
          useClass: AuthenticationGuard,
        },
      ],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();

    app = moduleRef.createNestApplication();
    setupSwagger(app);
    await app.init();
  }

  it('documents POST /v1/usage, including the 429 response', async () => {
    await initApp();

    const operation = createOpenApiDocument(app).paths['/v1/usage']?.post;
    const requestSchema =
      operation?.requestBody &&
      'content' in operation.requestBody &&
      operation.requestBody.content['application/json']?.schema;

    expect(operation).toBeDefined();
    expect(operation?.responses['201']).toBeDefined();
    expect(operation?.responses['400']).toBeDefined();
    expect(operation?.responses['429']).toBeDefined();
    expect(requestSchema).toEqual(
      expect.objectContaining({
        type: 'object',
        required: expect.arrayContaining([
          'customerId',
          'metric',
          'quantity',
          'idempotencyKey',
          'recordedAt',
        ]),
        properties: expect.objectContaining({
          customerId: expect.objectContaining({
            type: 'string',
            format: 'uuid',
          }),
          metric: expect.objectContaining({
            enum: ['API_CALLS', 'TOKENS', 'STORAGE_GB'],
          }),
          quantity: expect.objectContaining({ type: 'number' }),
          idempotencyKey: expect.objectContaining({ type: 'string' }),
          recordedAt: expect.objectContaining({ format: 'date-time' }),
        }),
      }),
    );
  });

  it('serves the Swagger UI without authentication and keeps private routes closed', async () => {
    await initApp();

    const docs = await request(app.getHttpServer()).get(`/${SWAGGER_PATH}`);
    const closed = await request(app.getHttpServer()).get('/closed');
    const usage = await request(app.getHttpServer()).post('/v1/usage').send({});

    expect(docs.status).toBe(200);
    expect(docs.text.toLowerCase()).toContain('swagger');
    expect(closed.status).toBe(401);
    expect(usage.status).toBe(400);
  });
});

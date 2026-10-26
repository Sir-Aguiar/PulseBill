import { existsSync, readFileSync } from 'node:fs';
import { Controller, Get, INestApplication, Module } from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants.js';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { afterEach, describe, expect, it } from 'vitest';
import { ApplicationError } from '../errors/application.error.js';
import { EntityError } from '../errors/entity.error.js';
import { AppModule } from '../../app.module.js';
import { IS_PUBLIC_KEY, Public } from '../decorators/public.decorator.js';
import { ApplicationErrorFilter } from './application-error.filter.js';

@Controller('probe')
class ProbeController {
  @Get('application')
  application(): void {
    throw new ApplicationError(409, 'Email already exists', new Error('P2002'));
  }

  @Get('entity')
  entity(): void {
    throw new EntityError('Payment is already settled');
  }

  @Get('unknown')
  unknown(): void {
    throw new Error('disk failed');
  }

  @Public()
  @Get('public')
  publicRoute(): string {
    return 'ok';
  }
}

@Module({ controllers: [ProbeController] })
class ProbeModule {}

describe('ApplicationErrorFilter', () => {
  let app: INestApplication<App>;

  afterEach(async () => {
    await app?.close();
  });

  async function initProbe(): Promise<void> {
    const moduleRef = await Test.createTestingModule({
      imports: [ProbeModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new ApplicationErrorFilter());
    await app.init();
  }

  it('returns the ApplicationError status and message without cause', async () => {
    await initProbe();

    const response = await request(app.getHttpServer()).get(
      '/probe/application',
    );

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      statusCode: 409,
      message: 'Email already exists',
    });
    expect(JSON.stringify(response.body)).not.toContain('P2002');
  });

  it('returns 422 and the EntityError message', async () => {
    await initProbe();

    const response = await request(app.getHttpServer()).get('/probe/entity');

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      statusCode: 422,
      message: 'Payment is already settled',
    });
  });

  it('leaves unknown errors to the Nest default handler', async () => {
    await initProbe();

    const response = await request(app.getHttpServer()).get('/probe/unknown');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      statusCode: 500,
      message: 'Internal server error',
    });
  });

  it('is registered globally in main.ts', () => {
    const source = readFileSync(
      new URL('../../main.ts', import.meta.url),
      'utf8',
    );

    expect(source).toContain('useGlobalFilters(new ApplicationErrorFilter())');
  });
});

describe('@Public()', () => {
  it('stores isPublic metadata readable by Reflector', () => {
    const reflector = new Reflector();

    expect(
      reflector.get<boolean>(
        IS_PUBLIC_KEY,
        ProbeController.prototype.publicRoute,
      ),
    ).toBe(true);
    expect(
      reflector.get(IS_PUBLIC_KEY, ProbeController.prototype.unknown),
    ).toBeUndefined();
  });
});

describe('Nest boilerplate', () => {
  it('does not register the sample controller', () => {
    const controllers = Reflect.getMetadata(
      MODULE_METADATA.CONTROLLERS,
      AppModule,
    ) as unknown[];

    expect(controllers).toEqual([]);
    expect(
      existsSync(new URL('../../app.controller.ts', import.meta.url)),
    ).toBe(false);
    expect(existsSync(new URL('../../app.service.ts', import.meta.url))).toBe(
      false,
    );
  });

  it('does not serve Hello World on GET /', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();

    const response = await request(app.getHttpServer()).get('/');

    expect(response.status).toBe(404);
    expect(response.text).not.toContain('Hello World');
    await app.close();
  });
});

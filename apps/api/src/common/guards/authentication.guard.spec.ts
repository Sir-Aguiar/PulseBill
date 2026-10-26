import { readFileSync } from 'node:fs';
import { Controller, Get, INestApplication, Module } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { afterEach, describe, expect, it } from 'vitest';
import { AppModule } from '../../app.module.js';
import { Public } from '../decorators/public.decorator.js';
import { AuthenticationGuard } from './authentication.guard.js';

@Controller('closed')
class ClosedController {
  @Public()
  @Get('open')
  open(): string {
    return 'open';
  }

  @Get('private')
  privateRoute(): string {
    return 'private';
  }
}

@Public()
@Controller('opened')
class OpenedController {
  @Get()
  index(): string {
    return 'class-public';
  }
}

@Module({
  controllers: [ClosedController, OpenedController],
  providers: [
    Reflector,
    {
      provide: APP_GUARD,
      useClass: AuthenticationGuard,
    },
  ],
})
class GuardProbeModule {}

describe('AuthenticationGuard', () => {
  let app: INestApplication<App>;

  afterEach(async () => {
    await app?.close();
  });

  async function initProbe(): Promise<void> {
    const moduleRef = await Test.createTestingModule({
      imports: [GuardProbeModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  }

  it('allows a handler marked with @Public()', async () => {
    await initProbe();

    const response = await request(app.getHttpServer()).get('/closed/open');

    expect(response.status).toBe(200);
    expect(response.text).toBe('open');
  });

  it('allows a class marked with @Public()', async () => {
    await initProbe();

    const response = await request(app.getHttpServer()).get('/opened');

    expect(response.status).toBe(200);
    expect(response.text).toBe('class-public');
  });

  it('returns the Nest unauthorized body when @Public() is absent', async () => {
    await initProbe();

    const response = await request(app.getHttpServer()).get('/closed/private');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      statusCode: 401,
      message: 'Unauthorized',
    });
  });

  it('is registered as APP_GUARD and stays out of the production controllers', () => {
    const providers = Reflect.getMetadata('providers', AppModule) as {
      provide?: unknown;
    }[];
    const controllers = Reflect.getMetadata(
      'controllers',
      AppModule,
    ) as unknown[];

    expect(providers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provide: APP_GUARD,
          useClass: AuthenticationGuard,
        }),
      ]),
    );
    expect(controllers).toEqual([]);
    expect(controllers).not.toContain(ClosedController);
    expect(controllers).not.toContain(OpenedController);
  });

  it('does not read the environment, the database, or a signature header', () => {
    const source = readFileSync(
      new URL('./authentication.guard.ts', import.meta.url),
      'utf8',
    );

    expect(source).not.toMatch(
      /EnvService|process\.env|prisma|Prisma|signature|hmac/i,
    );
  });
});

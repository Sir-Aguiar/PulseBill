import { createHmac } from 'node:crypto';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { EnvService } from '../../config/env.service.js';
import {
  WEBHOOK_SIGNATURE_HEADER,
  WebhookSignatureGuard,
} from './webhook-signature.guard.js';

const secret = 'test-webhook-secret';
const rawBody = Buffer.from('{"provider":"stripe","externalEventId":"evt_1"}');

function signatureFor(body: Buffer): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

function contextFor(
  headers: Record<string, string | undefined>,
  body = rawBody,
) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        headers,
        rawBody: body,
      }),
    }),
  } as ExecutionContext;
}

function guard(): WebhookSignatureGuard {
  const env = {
    get: (key: string) => {
      if (key === 'WEBHOOK_SIGNING_SECRET') {
        return secret;
      }
      throw new Error(`unexpected env key ${key}`);
    },
  } as EnvService;

  return new WebhookSignatureGuard(env);
}

describe('WebhookSignatureGuard', () => {
  it('allows a raw body signed with HMAC-SHA256', () => {
    expect(
      guard().canActivate(
        contextFor({
          [WEBHOOK_SIGNATURE_HEADER]: signatureFor(rawBody),
        }),
      ),
    ).toBe(true);
  });

  it('rejects a missing signature header', () => {
    expect(() => guard().canActivate(contextFor({}))).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a different signature', () => {
    expect(() =>
      guard().canActivate(
        contextFor({
          [WEBHOOK_SIGNATURE_HEADER]: signatureFor(Buffer.from('other-body')),
        }),
      ),
    ).toThrow(UnauthorizedException);
  });
});

import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { EnvService } from '../../config/env.service.js';

export const WEBHOOK_SIGNATURE_HEADER = 'x-pulsebill-signature';

type WebhookRequest = {
  headers: Record<string, string | string[] | undefined>;
  rawBody?: Buffer;
};

@Injectable()
export class WebhookSignatureGuard implements CanActivate {
  constructor(private readonly env: EnvService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<WebhookRequest>();
    const header = request.headers[WEBHOOK_SIGNATURE_HEADER];
    const signature = Array.isArray(header) ? header[0] : header;
    const rawBody = request.rawBody ?? Buffer.alloc(0);

    if (!signature || !this.signaturesMatch(rawBody, signature)) {
      throw new UnauthorizedException();
    }

    return true;
  }

  private signaturesMatch(rawBody: Buffer, signature: string): boolean {
    const expected = createHmac(
      'sha256',
      this.env.get('WEBHOOK_SIGNING_SECRET'),
    )
      .update(rawBody)
      .digest('hex');
    const expectedBuffer = Buffer.from(expected);
    const providedBuffer = Buffer.from(signature);

    if (expectedBuffer.length !== providedBuffer.length) {
      return false;
    }

    return timingSafeEqual(expectedBuffer, providedBuffer);
  }
}

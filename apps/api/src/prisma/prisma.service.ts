import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client.js';
import { EnvService } from '../config/env.service.js';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(env: EnvService) {
    super({
      adapter: new PrismaPg(env.get('DATABASE_URL')),
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

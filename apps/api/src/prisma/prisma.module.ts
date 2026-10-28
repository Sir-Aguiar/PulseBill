import { Module } from '@nestjs/common';
import { EnvService } from '../config/env.service.js';
import { PrismaService } from './prisma.service.js';

@Module({
  providers: [EnvService, PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}

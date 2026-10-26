import { Module } from '@nestjs/common';
import { EnvService } from './config/env.service.js';

@Module({
  imports: [],
  controllers: [],
  providers: [EnvService],
})
export class AppModule {}

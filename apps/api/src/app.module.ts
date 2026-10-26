import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthenticationGuard } from './common/guards/authentication.guard.js';
import { EnvService } from './config/env.service.js';

@Module({
  imports: [],
  controllers: [],
  providers: [
    EnvService,
    {
      provide: APP_GUARD,
      useClass: AuthenticationGuard,
    },
  ],
})
export class AppModule {}

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ApplicationErrorFilter } from './common/filters/application-error.filter.js';
import { EnvService } from './config/env.service.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.useGlobalFilters(new ApplicationErrorFilter());
  const env = app.get(EnvService);
  await app.listen(env.get('API_PORT'));
}

await bootstrap();

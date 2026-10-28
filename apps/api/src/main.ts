import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ApplicationErrorFilter } from './common/filters/application-error.filter.js';
import { EnvService } from './config/env.service.js';
import { setupSwagger } from './swagger.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalFilters(new ApplicationErrorFilter());
  setupSwagger(app);
  const env = app.get(EnvService);
  await app.listen(env.get('API_PORT'));
}

await bootstrap();

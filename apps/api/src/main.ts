import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { EnvService } from './config/env.service.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const env = app.get(EnvService);
  await app.listen(env.get('API_PORT'));
}

await bootstrap();

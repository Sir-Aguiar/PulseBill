import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { OpenAPIObject } from '@nestjs/swagger';

export const SWAGGER_PATH = 'docs';

export const createOpenApiDocument = (app: INestApplication): OpenAPIObject => {
  const config = new DocumentBuilder()
    .setTitle('PulseBill')
    .setDescription('PulseBill HTTP API')
    .setVersion('1.0')
    .build();

  return SwaggerModule.createDocument(app, config);
};

export const setupSwagger = (app: INestApplication): void => {
  SwaggerModule.setup(SWAGGER_PATH, app, () => createOpenApiDocument(app));
};

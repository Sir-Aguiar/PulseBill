import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApplicationError } from '../errors/application.error.js';
import { EntityError } from '../errors/entity.error.js';

@Catch(ApplicationError, EntityError)
export class ApplicationErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApplicationErrorFilter.name);

  catch(exception: ApplicationError | EntityError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<{
      status: (code: number) => { json: (body: unknown) => void };
    }>();
    const status =
      exception instanceof ApplicationError
        ? exception.status
        : HttpStatus.UNPROCESSABLE_ENTITY;

    if (
      exception instanceof ApplicationError &&
      exception.cause !== undefined
    ) {
      const cause = exception.cause;
      this.logger.error(
        exception.message,
        cause instanceof Error ? cause.stack : String(cause),
      );
    }

    response.status(status).json({
      statusCode: status,
      message: exception.message,
    });
  }
}

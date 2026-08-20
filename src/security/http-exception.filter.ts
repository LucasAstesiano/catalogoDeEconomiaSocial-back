import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';

export function postgresConflictMessage(exception: unknown): string | null {
  if (!(exception instanceof QueryFailedError)) return null;
  const code = (exception.driverError as { code?: string })?.code;
  if (code === '23505') return 'Ya existe un registro con esos datos';
  if (code === '23503') {
    return 'El registro esta relacionado con otros datos y no puede eliminarse';
  }
  return null;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const databaseError = postgresConflictMessage(exception);
    const isHttpException = exception instanceof HttpException;
    const status = databaseError
      ? HttpStatus.CONFLICT
      : isHttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    if (!isHttpException) {
      this.logger.error(
        JSON.stringify({
          event: 'unhandled_exception',
          method: request.method,
          path: request.originalUrl,
          status,
          exception:
            exception instanceof Error ? exception.name : 'UnknownException',
        }),
      );
    }

    const body = databaseError
      ? { statusCode: status, message: databaseError }
      : isHttpException
        ? exception.getResponse()
        : {
            statusCode: status,
            message: 'Error interno del servidor',
          };

    response.status(status).json(body);
  }
}

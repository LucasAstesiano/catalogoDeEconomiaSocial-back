import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
  HttpException,
} from '@nestjs/common';
import type { Response } from 'express';
import { Observable } from 'rxjs';
import { finalize, tap } from 'rxjs/operators';
import type { AuthenticatedRequest } from '../auth/auth.types';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Audit');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const response = context.switchToHttp().getResponse<Response>();
    const startedAt = Date.now();
    let errorStatus: number | null = null;

    return next.handle().pipe(
      tap({
        error: (error: unknown) => {
          errorStatus =
            error instanceof HttpException ? error.getStatus() : 500;
        },
      }),
      finalize(() => {
        this.logger.log(
          JSON.stringify({
            timestamp: new Date().toISOString(),
            method: request.method,
            path: request.originalUrl,
            status: errorStatus ?? response.statusCode,
            durationMs: Date.now() - startedAt,
            ip: request.ip,
            userId: request.user?.sub ?? null,
            role: request.user?.rol ?? null,
          }),
        );
      }),
    );
  }
}

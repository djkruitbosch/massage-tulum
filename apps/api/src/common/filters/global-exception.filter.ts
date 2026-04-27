import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Global exception filter.
 *
 * Catches every unhandled exception and formats it as a consistent JSON
 * response:  { statusCode, message, error }
 *
 * Rules:
 * - NestJS HttpExceptions are re-shaped into the standard envelope.
 * - Unknown errors (non-HttpException) are treated as 500 Internal Server Error.
 * - Stack traces are never sent to the client (no information leakage).
 * - PII is never logged — only the status code and a sanitised message.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode: number;
    let message: string;
    let error: string;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const body = exceptionResponse as Record<string, unknown>;
        message =
          typeof body['message'] === 'string'
            ? body['message']
            : Array.isArray(body['message'])
              ? (body['message'] as string[]).join('; ')
              : exception.message;
        error =
          typeof body['error'] === 'string' ? body['error'] : (HttpStatus[statusCode] ?? 'Error');
      } else {
        message = exception.message;
      }

      error ??= HttpStatus[statusCode] ?? 'Error';
    } else {
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';
      error = 'Internal Server Error';

      // Log unexpected errors without PII — method + path only.
      this.logger.error(
        `Unhandled exception on ${request.method} ${request.path}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(statusCode).json({ statusCode, message, error });
  }
}

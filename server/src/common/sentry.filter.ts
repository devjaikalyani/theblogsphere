import { ArgumentsHost, Catch, HttpException, HttpStatus } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import * as Sentry from '@sentry/node';

/** Reports unexpected server failures (5xx / non-HttpException) to Sentry, then
 *  hands off to Nest's default handler so the HTTP response is unchanged.
 *  Routine 4xx (validation, auth, quota) are not reported. No-op when
 *  SENTRY_DSN is unset. */
@Catch()
export class SentryExceptionFilter extends BaseExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    if (status >= 500 && process.env.SENTRY_DSN) {
      Sentry.captureException(exception);
    }
    super.catch(exception, host);
  }
}

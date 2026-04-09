import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { I18nService } from './i18n.service';
import { AppLocale, DEFAULT_LOCALE } from './locale.types';
import { resolveLocaleFromHeaders } from './locale.util';

@Catch()
export class HttpI18nExceptionFilter implements ExceptionFilter {
  constructor(private readonly i18nService: I18nService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request & { locale?: AppLocale }>();
    const response = ctx.getResponse<Response>();
    const locale =
      request.locale ??
      resolveLocaleFromHeaders(request.headers as Record<string, unknown>) ??
      DEFAULT_LOCALE;

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      const translated = this.translatePayload(payload, locale);
      response.status(status).json(translated);
      return;
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: this.i18nService.translateMessage('Internal server error', locale),
      error: 'Internal Server Error',
    });
  }

  private translatePayload(payload: unknown, locale: AppLocale): unknown {
    if (typeof payload === 'string') {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        message: this.i18nService.translateMessage(payload, locale),
      };
    }

    if (!payload || typeof payload !== 'object') {
      return payload;
    }

    const raw = payload as Record<string, unknown>;
    const message = raw['message'];

    if (typeof message === 'string') {
      return { ...raw, message: this.i18nService.translateMessage(message, locale) };
    }

    if (Array.isArray(message)) {
      const translatedMessages = (message as unknown[]).map((item) =>
        typeof item === 'string' ? this.i18nService.translateMessage(item, locale) : String(item),
      );
      return {
        ...raw,
        message: translatedMessages,
      };
    }

    return raw;
  }
}

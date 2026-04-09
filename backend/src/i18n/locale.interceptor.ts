import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { resolveLocaleFromHeaders } from './locale.util';

@Injectable()
export class LocaleInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, unknown>; locale?: string }>();
    const response = context
      .switchToHttp()
      .getResponse<{ setHeader: (name: string, value: string) => void }>();

    const locale = resolveLocaleFromHeaders(request.headers ?? {});
    request.locale = locale;
    response.setHeader('Content-Language', locale);

    return next.handle();
  }
}

import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { HttpI18nExceptionFilter } from './i18n/http-i18n-exception.filter';
import { I18nService } from './i18n/i18n.service';
import { LocaleInterceptor } from './i18n/locale.interceptor';
import { AppModule } from './app.module';

function parseCorsOrigins(rawOrigins: string | undefined): string[] {
  if (!rawOrigins) {
    return ['http://localhost:4200'];
  }

  return rawOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

export async function createConfiguredApp() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const corsOrigins = parseCorsOrigins(configService.get<string>('CORS_ORIGINS'));
  const allowVercelPreviews =
    (configService.get<string>('CORS_ALLOW_VERCEL_PREVIEWS') ?? '').toLowerCase() === 'true';

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (corsOrigins.includes('*') || corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      if (allowVercelPreviews && /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS blocked for origin: ${origin}`), false);
    },
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalInterceptors(new LocaleInterceptor());
  app.useGlobalFilters(new HttpI18nExceptionFilter(app.get(I18nService)));

  return app;
}

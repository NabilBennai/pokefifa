import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { compare } from 'bcrypt';
import { Request, Response, NextFunction } from 'express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { PrismaService } from './prisma/prisma.service';
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

function parseBooleanFlag(value: string | undefined, fallback = false): boolean {
  if (!value) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(normalized);
}

function normalizeSwaggerPath(rawPath: string | undefined): string {
  const fallback = 'internal/docs-admin-reference';
  const source = rawPath?.trim() || fallback;
  return source.replace(/^\/+/, '').replace(/\/+$/, '');
}

function requestSwaggerCredentials(
  response: Response,
  realm: string,
  message = 'Admin credentials are required.',
): void {
  response.setHeader('WWW-Authenticate', `Basic realm=\"${realm}\", charset=\"UTF-8\"`);
  response.status(401).send(message);
}

async function setupProtectedSwagger(app: INestApplication) {
  const configService = app.get(ConfigService);
  const swaggerEnabled = parseBooleanFlag(configService.get<string>('SWAGGER_ENABLED'), false);
  if (!swaggerEnabled) {
    return;
  }

  const swaggerPath = normalizeSwaggerPath(configService.get<string>('SWAGGER_PATH'));
  const swaggerRealm = configService.get<string>('SWAGGER_REALM', 'PokeUT Admin Docs');
  const prisma = app.get(PrismaService);

  app.use(`/${swaggerPath}`, async (request: Request, response: Response, next: NextFunction) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      requestSwaggerCredentials(response, swaggerRealm);
      return;
    }

    const encoded = authHeader.slice('Basic '.length).trim();
    const decoded = Buffer.from(encoded, 'base64').toString('utf8');
    const separatorIndex = decoded.indexOf(':');
    if (separatorIndex <= 0) {
      requestSwaggerCredentials(response, swaggerRealm);
      return;
    }

    const email = decoded.slice(0, separatorIndex).trim().toLowerCase();
    const password = decoded.slice(separatorIndex + 1);
    if (!email || !password) {
      requestSwaggerCredentials(response, swaggerRealm);
      return;
    }

    const adminUser = await prisma.user.findFirst({
      where: { email, role: 'ADMIN' },
      select: { passwordHash: true },
    });

    if (!adminUser) {
      requestSwaggerCredentials(response, swaggerRealm);
      return;
    }

    const validPassword = await compare(password, adminUser.passwordHash);
    if (!validPassword) {
      requestSwaggerCredentials(response, swaggerRealm);
      return;
    }

    next();
  });

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('PokeUT API')
      .setDescription('Private admin-facing API reference')
      .setVersion('1.0.0')
      .addBearerAuth()
      .build(),
  );

  SwaggerModule.setup(swaggerPath, app, document, {
    jsonDocumentUrl: `${swaggerPath}/openapi.json`,
    yamlDocumentUrl: `${swaggerPath}/openapi.yaml`,
  });
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
  await setupProtectedSwagger(app);

  return app;
}

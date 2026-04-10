import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { LanguageService } from '../i18n/language.service';
import { AuthService } from '../services/auth.service';
import { API_BASE_URL } from '../tokens/api-base-url.token';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const authService = inject(AuthService);
  const languageService = inject(LanguageService);
  const apiBaseUrl = inject(API_BASE_URL);
  const accessToken = authService.getAccessToken();

  if (!request.url.startsWith(apiBaseUrl)) {
    return next(request);
  }

  const locale = languageService.locale();
  const headers: Record<string, string> = {
    'Accept-Language': locale,
    'X-Locale': locale,
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  return next(request.clone({ setHeaders: headers }));
};

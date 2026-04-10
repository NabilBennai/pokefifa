import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, Observable, of, tap } from 'rxjs';
import { AuthResponse, AuthUser, LoginPayload, RegisterPayload } from '../models/auth.models';
import { API_BASE_URL } from '../tokens/api-base-url.token';

const ACCESS_TOKEN_KEY = 'pokefifa_access_token';
const AUTH_USER_KEY = 'pokefifa_auth_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  private readonly tokenState = signal<string | null>(localStorage.getItem(ACCESS_TOKEN_KEY));
  private readonly userState = signal<AuthUser | null>(this.readStoredUser());
  private readonly bootstrappedState = signal(false);

  readonly token = this.tokenState.asReadonly();
  readonly user = this.userState.asReadonly();
  readonly bootstrapped = this.bootstrappedState.asReadonly();
  readonly isAuthenticated = computed(() => !!this.tokenState());

  constructor() {
    if (this.tokenState() && !this.userState()) {
      this.refreshProfile().subscribe();
    } else {
      this.bootstrappedState.set(true);
    }
  }

  login(payload: LoginPayload): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.apiBaseUrl}/auth/login`, payload)
      .pipe(tap((response) => this.setSession(response)));
  }

  register(payload: RegisterPayload): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.apiBaseUrl}/auth/register`, payload)
      .pipe(tap((response) => this.setSession(response)));
  }

  refreshProfile(): Observable<AuthUser | null> {
    return this.http.get<AuthUser>(`${this.apiBaseUrl}/auth/me`).pipe(
      tap((user) => {
        this.userState.set(user);
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
        this.bootstrappedState.set(true);
      }),
      catchError(() => {
        this.clearSession();
        this.bootstrappedState.set(true);
        return of(null);
      }),
    );
  }

  logout(redirect = true): void {
    this.clearSession();
    if (redirect) {
      void this.router.navigateByUrl('/');
    }
  }

  getAccessToken(): string | null {
    return this.tokenState();
  }

  private setSession(response: AuthResponse): void {
    this.tokenState.set(response.accessToken);
    this.userState.set(response.user);
    this.bootstrappedState.set(true);
    localStorage.setItem(ACCESS_TOKEN_KEY, response.accessToken);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(response.user));
  }

  private clearSession(): void {
    this.tokenState.set(null);
    this.userState.set(null);
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
  }

  private readStoredUser(): AuthUser | null {
    const raw = localStorage.getItem(AUTH_USER_KEY);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as AuthUser;
    } catch {
      localStorage.removeItem(AUTH_USER_KEY);
      return null;
    }
  }
}

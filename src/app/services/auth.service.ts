import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { clearHttpCache } from '../interceptors/http-cache.interceptor';

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly session = signal<any>(null);

  constructor(private http: HttpClient) {}

  refreshSession(): Observable<any> {
    return this.http.get('/api/auth/get-session', { withCredentials: true }).pipe(
      tap({
        next: (s) => this.session.set(s ?? null),
        error: () => this.session.set(null),
      }),
    );
  }

  signup(data: { email: string; password: string; name: string; firstName: string; lastName: string }): Observable<any> {
    return this.http.post('/api/auth/sign-up/email', data, { withCredentials: true });
  }

  login(data: { email: string; password: string }): Observable<any> {
    return this.http.post('/api/auth/sign-in/email', data, { withCredentials: true }).pipe(
      tap(() => clearHttpCache()),
    );
  }

  logout(): Observable<any> {
    return this.http.post('/api/auth/sign-out', {}, { withCredentials: true }).pipe(
      tap(() => {
        this.session.set(null);
        clearHttpCache();
      }),
    );
  }

  getSession(): Observable<any> {
    return this.http.get('/api/auth/get-session', { withCredentials: true });
  }

  deleteAccount(): Observable<any> {
    return this.http.delete('/api/users/me', { withCredentials: true }).pipe(
      tap(() => {
        this.session.set(null);
        clearHttpCache();
      }),
    );
  }

  forgetPassword(email: string): Observable<any> {
    const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/reset-password` : '/reset-password';
    return this.http.post('/api/auth/forget-password', { email, redirectTo }, { withCredentials: true });
  }

  resetPassword(newPassword: string, token: string): Observable<any> {
    return this.http.post('/api/auth/reset-password', { newPassword, token }, { withCredentials: true });
  }
}

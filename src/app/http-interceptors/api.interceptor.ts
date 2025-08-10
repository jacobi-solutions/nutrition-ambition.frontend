import { inject, NgZone } from '@angular/core';
import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, from, throwError, of } from 'rxjs';
import { first, switchMap, catchError } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { environment } from 'src/environments/environment';

// Helper: determine if request is public and should bypass auth
function isPublicRequest(req: HttpRequest<any>, apiBaseUrl: string): boolean {
  if (!req.url.startsWith(apiBaseUrl)) return true; // Non-API requests
  if (req.url.includes('/assets/')) return true; // Static assets
  // TODO: Add explicit public API endpoints as needed, e.g., `${apiBaseUrl}/auth/*`
  return false;
}

export const ApiInterceptor: HttpInterceptorFn = (req: HttpRequest<any>, next: HttpHandlerFn): Observable<HttpEvent<any>> => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const zone = inject(NgZone);
  // Use AuthService for UI coordination

  const apiBaseUrl = environment.backendApiUrl;

  // Allowlist public requests
  if (isPublicRequest(req, apiBaseUrl)) {
    return next(req);
  }

  const addHeaders = (token: string | null): HttpRequest<any> => {
    const headers: { [key: string]: string } = {
      'X-Timezone': Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return req.clone({ setHeaders: headers });
  };

  // Wait for AuthService readiness, then enforce explicit auth
  return authService.authReady$.pipe(
    first(),
    switchMap(() => from(authService.getFreshIdToken(false))),
    switchMap(token => {
      if (!token) {
        if ((environment as any).authDebug) {
          // eslint-disable-next-line no-console
          console.warn('[ApiInterceptor] No current user/token; requiring auth for request', req.url);
        }
        // Surface auth required and navigate to login
        try {
          // best-effort notify; relies on the service subject existing
          (authService as any)._authRequired$?.next(true);
        } catch {}
        try {
          const currentRoute = router.url;
          authService.setLastAttemptedRoute(currentRoute);
          authService.setAuthNotice('Sign in or continue as guest to proceed.');
        } catch {}
        zone.run(() => router.navigate(['/login']));
        return throwError(() => new HttpErrorResponse({ status: 401, statusText: 'Auth required (no user)' }));
      }

      const authedReq = addHeaders(token);
      return next(authedReq).pipe(
        catchError(err => {
          if (err?.status !== 401) {
            return throwError(() => err);
          }

          if ((environment as any).authDebug) {
            // eslint-disable-next-line no-console
            console.debug('[ApiInterceptor] 401 received; attempting one-time token refresh');
          }

          // Retry once with a forced refresh
          return from(authService.getFreshIdToken(true)).pipe(
            switchMap(refreshed => {
              if (refreshed) {
                if ((environment as any).authDebug) {
                  // eslint-disable-next-line no-console
                  console.debug('[ApiInterceptor] Retrying request with refreshed token');
                }
                const retryReq = addHeaders(refreshed);
                return next(retryReq);
              }

              if ((environment as any).authDebug) {
                // eslint-disable-next-line no-console
                console.debug('[ApiInterceptor] 401 after refresh (no token); forcing logout');
              }
              // Remember current route before forcing logout
              try {
                const currentRoute = router.url;
                authService.setLastAttemptedRoute(currentRoute);
                authService.setAuthNotice('Session expired. Please sign in again or continue as guest.');
              } catch {}
              return from(authService.signOutUser()).pipe(
                switchMap(() => throwError(() => err)),
                catchError(() => throwError(() => err))
              );
            }),
            catchError(() => {
              if ((environment as any).authDebug) {
                // eslint-disable-next-line no-console
                console.debug('[ApiInterceptor] 401 after refresh (error); forcing logout');
              }
              try {
                const currentRoute = router.url;
                authService.setLastAttemptedRoute(currentRoute);
                authService.setAuthNotice('Session expired. Please sign in again or continue as guest.');
              } catch {}
              return from(authService.signOutUser()).pipe(
                switchMap(() => throwError(() => err)),
                catchError(() => throwError(() => err))
              );
            })
          );
        })
      );
    })
  );
};
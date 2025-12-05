import { inject, NgZone } from '@angular/core';
import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, from, throwError, EMPTY } from 'rxjs';
import { first, switchMap, catchError } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { PlatformService } from '../services/platform.service';
import { RestrictedAccessService } from '../services/restricted-access.service';
import { environment } from 'src/environments/environment';
import { APP_VERSION, PREVIOUS_COMMIT_HASH } from 'src/environments/version';

function isPublicRequest(req: HttpRequest<any>, apiBaseUrl: string): boolean {
  if (!req.url.startsWith(apiBaseUrl)) return true;
  if (req.url.includes('/assets/')) return true;
  if (req.url.includes('/Auth/ValidateHandoff')) return true;
  return false;
}

export const ApiInterceptor: HttpInterceptorFn = (req: HttpRequest<any>, next: HttpHandlerFn): Observable<HttpEvent<any>> => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const zone = inject(NgZone);
  const platformService = inject(PlatformService);
  const restrictedAccessService = inject(RestrictedAccessService);

  const apiBaseUrl = environment.backendApiUrl;

  if (isPublicRequest(req, apiBaseUrl)) {
    return next(req);
  }

  const addHeaders = (token: string | null): HttpRequest<any> => {
    const headers: { [key: string]: string } = {
      'X-Timezone': Intl.DateTimeFormat().resolvedOptions().timeZone,
      'X-Client-Version': APP_VERSION,
      'X-Client-PreviousCommitHash': PREVIOUS_COMMIT_HASH,
      'X-Client-Platform': platformService.getPlatform()
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return req.clone({ setHeaders: headers });
  };

  return authService.authReady$.pipe(
    first(),
    switchMap(() => from(authService.getFreshIdToken(false))),
    switchMap(token => {
      if (!token) {
        try {
          (authService as any)._authRequired$?.next(true);
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
          // Handle 403 Restricted Access errors
          if (restrictedAccessService.isRestrictedAccessError(err)) {
            const info = restrictedAccessService.getRestrictedAccessInfo(err);
            if (info) {
              // Handle the restricted access asynchronously
              zone.run(() => {
                restrictedAccessService.handleRestrictedAccess(info.phase, info.redirectUrl);
              });
              // Return EMPTY to prevent the error from propagating
              return EMPTY;
            }
          }

          if (err?.status !== 401) return throwError(() => err);

          return from(authService.getFreshIdToken(true)).pipe(
            switchMap(refreshed => {
              if (refreshed) {
                const retryReq = addHeaders(refreshed);
                return next(retryReq);
              }
              return from(authService.signOutUser()).pipe(
                switchMap(() => throwError(() => err)),
                catchError(() => throwError(() => err))
              );
            }),
            catchError(() => {
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

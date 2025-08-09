import { inject } from '@angular/core';
import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpEvent } from '@angular/common/http';
import { Observable, from, throwError } from 'rxjs';
import { first, switchMap, catchError } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { environment } from 'src/environments/environment';

export const ApiInterceptor: HttpInterceptorFn = (req: HttpRequest<any>, next: HttpHandlerFn): Observable<HttpEvent<any>> => {
  const authService = inject(AuthService);
  const backendUrl = environment.backendApiUrl;

  // Only intercept requests to our backend API
  if (!req.url.startsWith(backendUrl)) {
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

  // Wait for AuthService to be ready, then attach token if available
  return authService.authReady$.pipe(
    first(),
    switchMap(() => from(authService.getFreshIdToken(false))),
    switchMap(token => {
      if ((environment as any).authDebug) {
        // eslint-disable-next-line no-console
        console.debug('ApiInterceptor: attaching token on first attempt?', !!token);
      }
      const intercepted = addHeaders(token);
      return next(intercepted).pipe(
        catchError(err => {
          if (err?.status === 401) {
            if ((environment as any).authDebug) {
              // eslint-disable-next-line no-console
              console.debug('ApiInterceptor: 401 received, attempting one-time token refresh');
            }
            return from(authService.getFreshIdToken(true)).pipe(
              switchMap(refreshed => {
                if (refreshed) {
                  if ((environment as any).authDebug) {
                    // eslint-disable-next-line no-console
                    console.debug('ApiInterceptor: retrying request with refreshed token');
                  }
                  const retryReq = addHeaders(refreshed);
                  return next(retryReq);
                }
                return throwError(() => err);
              }),
              catchError(retryErr => throwError(() => retryErr))
            );
          }
          return throwError(() => err);
        })
      );
    })
  );
}; 
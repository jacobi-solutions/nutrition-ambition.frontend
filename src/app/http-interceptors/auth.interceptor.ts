// src/app/services/auth.interceptor.ts
import { inject } from '@angular/core';
import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpEvent } from '@angular/common/http';
import { Observable, from } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { environment } from 'src/environments/environment';

export const AuthInterceptor: HttpInterceptorFn = (req: HttpRequest<any>, next: HttpHandlerFn): Observable<HttpEvent<any>> => {
  const authService = inject(AuthService);
  const backendUrl = environment.backendApiUrl;

  // Only intercept requests to our backend API
  if (!req.url.startsWith(backendUrl)) {
    return next(req);
  }

  // Get ID token from Firebase Auth (will lazily sign in anonymously if needed)
  return from(authService.getIdToken()).pipe(
    switchMap(token => {
      if (token) {
        // Clone the request and add the Authorization header with the token
        const authorizedRequest = req.clone({
          setHeaders: {
            Authorization: `Bearer ${token}`
          }
        });
        return next(authorizedRequest);
      }
      // If no token (should rarely happen), proceed without authorization
      return next(req);
    })
  );
};


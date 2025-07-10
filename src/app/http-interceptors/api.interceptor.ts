import { inject } from '@angular/core';
import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpEvent } from '@angular/common/http';
import { Observable, from } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { environment } from 'src/environments/environment';

export const ApiInterceptor: HttpInterceptorFn = (req: HttpRequest<any>, next: HttpHandlerFn): Observable<HttpEvent<any>> => {
  const authService = inject(AuthService);
  const backendUrl = environment.backendApiUrl;

  // Only intercept requests to our backend API
  if (!req.url.startsWith(backendUrl)) {
    return next(req);
  }

  // Get ID token from Firebase Auth (will lazily sign in anonymously if needed)
  return from(authService.getIdToken()).pipe(
    switchMap(token => {
      const headers: { [key: string]: string } = {
        'X-Timezone': Intl.DateTimeFormat().resolvedOptions().timeZone
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // Clone the request and add the headers
      const interceptedRequest = req.clone({
        setHeaders: headers
      });

      return next(interceptedRequest);
    })
  );
}; 
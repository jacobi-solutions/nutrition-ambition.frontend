import { Injectable } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { AccountsService } from '../services/accounts.service';
import { filter, take, switchMap } from 'rxjs/operators';
import { from } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class AuthGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private accountsService: AccountsService,
    private router: Router
  ) {}

  canActivate(route: ActivatedRouteSnapshot) {
    const targetPath = route.routeConfig?.path || '';
    console.log('[AuthGuard] canActivate called for:', window.location.pathname);
    console.log('[AuthGuard] Current URL:', window.location.href);

    // Add timeout logging to detect if authReady$ never emits
    const timeoutId = setTimeout(() => {
      console.log('[AuthGuard] WARNING: authReady$ has not emitted after 5 seconds!');
    }, 5000);

    return this.authService.authReady$.pipe(
      filter(ready => {
        console.log('[AuthGuard] authReady$ emitted:', ready);
        return ready;
      }),
      take(1),
      switchMap(() => {
        clearTimeout(timeoutId);
        console.log('[AuthGuard] authReady, checking isAuthenticated...');
        return from(this.authService.isAuthenticated());
      }),
      switchMap(async isAuthed => {
        console.log('[AuthGuard] isAuthenticated result:', isAuthed);
        if (!isAuthed) {
          console.log('[AuthGuard] Not authenticated, redirecting to login');
          this.router.navigate(['/login']);
          return false;
        }

        // Load account if not already loaded to check trial status
        if (!this.accountsService.currentAccount) {
          await this.accountsService.loadAccount();
        }

        // Trial expiration is now handled by RestrictedAccess mode on the backend
        // which shows paidUpgrade prompts in the chat instead of redirecting
        return true;
      })
    );
  }
}

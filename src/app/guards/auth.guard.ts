import { Injectable } from '@angular/core';
import { CanActivate, CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { AccountsService } from '../services/accounts.service';
import { map, filter, take } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class AuthGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private accountService: AccountsService,
    private router: Router
  ) {}

  canActivate() {
    return this.authService.authReady$.pipe(
      filter(ready => ready), // ⏳ Wait until Firebase Auth is initialized
      take(1),                // ✅ Only take the first ready event
      map(() => {
        const anonId = this.accountService.getAccountId();
        if (this.authService.isAuthenticated() || anonId) {
          return true;
        } else {
          this.router.navigate(['/login']);
          return false;
        }
      })
    );
  }
}

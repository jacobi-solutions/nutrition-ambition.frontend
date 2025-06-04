import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { map, filter, take, switchMap } from 'rxjs/operators';
import { from } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class AuthGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate() {
    return this.authService.authReady$.pipe(
      filter(ready => ready), // ⏳ Wait until Firebase Auth is initialized
      take(1),                // ✅ Only take the first ready event
      switchMap(() => from(this.authService.isAuthenticated())),
      map(isAuthed => {
        if (isAuthed) {
          return true;
        } else {
          this.router.navigate(['/login']);
          return false;
        }
      })
    );
  }
}

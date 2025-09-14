import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AccountsService } from '../services/accounts.service';
import { map, filter, take } from 'rxjs/operators';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class OwnerGuard implements CanActivate {
  constructor(
    private accountsService: AccountsService,
    private router: Router
  ) {}

  canActivate(): Observable<boolean> {
    return this.accountsService.account$.pipe(
      filter(account => account !== null), // Wait for account to be loaded (not null)
      take(1), // Only take the first non-null value
      map(account => {
        if (account && account.isOwner === true) {
          return true;
        } else {
          this.router.navigate(['/app/chat']); // Redirect to main app
          return false;
        }
      })
    );
  }
} 
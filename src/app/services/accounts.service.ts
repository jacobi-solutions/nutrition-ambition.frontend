import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { NutritionAmbitionApiService, Account, AccountResponse, Request } from './nutrition-ambition-api.service';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class AccountsService {
  private _accountSubject = new BehaviorSubject<Account | null>(null);
  public account$ = this._accountSubject.asObservable();

  // Tracks when a user just upgraded from guest to full account
  // This is consumed once by chat page to trigger auto-continue behavior
  private _justUpgradedFromGuest = false;

  private authService = inject(AuthService);

  constructor(
    private apiService: NutritionAmbitionApiService
  ) {
    // Clear account data when user signs out (userUid$ emits null)
    this.authService.userUid$.subscribe(uid => {
      if (uid === null) {
        this.clearAccount();
      }
    });
  }

  async loadAccount(): Promise<void> {
    try {
      const response: AccountResponse = await firstValueFrom(this.apiService.getAccount({} as Request));
      
      if (response.isSuccess && response.account) {
        this._accountSubject.next(response.account);
      } else {
        this._accountSubject.next(null);
      }
    } catch (error) {
      this._accountSubject.next(null);
    }
  }

  get currentAccount(): Account | null {
    return this._accountSubject.value;
  }

  get isTrialExpired(): boolean {
    const account = this.currentAccount;
    if (!account) return false;
    if (account.isPremium || account.isPremiumLifetime) return false;
    if (!account.trialEndDateUtc) return false;
    return new Date() > new Date(account.trialEndDateUtc);
  }

  clearAccount(): void {
    this._accountSubject.next(null);
    this._justUpgradedFromGuest = false;
  }

  // Called after a guest user successfully creates an account
  setJustUpgradedFromGuest(): void {
    this._justUpgradedFromGuest = true;
  }

  // Consumes the flag (returns true once, then resets to false)
  consumeJustUpgradedFromGuest(): boolean {
    const value = this._justUpgradedFromGuest;
    this._justUpgradedFromGuest = false;
    return value;
  }
} 
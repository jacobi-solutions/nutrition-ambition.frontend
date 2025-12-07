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

  // Flags for upgrade continuation logic (works for both guest→account AND trial→paid)
  // Stored in sessionStorage to survive navigation and potential page reloads during auth flow
  // skipUpgradeContinuation: Set when FAB/edit triggers restricted flow (nothing to continue)
  // pendingUpgradeContinuation: Set when user clicks upgrade button after sending a message
  private static readonly SKIP_UPGRADE_KEY = 'na_skipUpgradeContinuation';
  private static readonly PENDING_UPGRADE_KEY = 'na_pendingUpgradeContinuation';

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
    // Clear upgrade continuation flags on sign out
    this.clearUpgradeContinuationFlags();
  }

  /**
   * Clear both upgrade continuation flags.
   * Called on sign out and when user is no longer in restricted mode.
   */
  private clearUpgradeContinuationFlags(): void {
    sessionStorage.removeItem(AccountsService.SKIP_UPGRADE_KEY);
    sessionStorage.removeItem(AccountsService.PENDING_UPGRADE_KEY);
  }

  /**
   * Set flag to skip continuation after upgrade.
   * Call this when FAB/edit/403 triggers restricted flow (nothing to continue).
   */
  setSkipUpgradeContinuation(): void {
    console.log('[AccountsService] setSkipUpgradeContinuation called');
    sessionStorage.setItem(AccountsService.SKIP_UPGRADE_KEY, 'true');
  }

  /**
   * Set flag indicating user clicked an upgrade button after a message was interrupted.
   * Call this when user clicks "Create your account" or "Manage account" from restricted access message.
   */
  setPendingUpgradeContinuation(): void {
    console.log('[AccountsService] setPendingUpgradeContinuation called');
    sessionStorage.setItem(AccountsService.PENDING_UPGRADE_KEY, 'true');
  }

  /**
   * Check if pendingUpgradeContinuation flag is set without consuming it.
   * Use this to decide navigation strategy in signup.page.ts.
   */
  get hasPendingUpgradeContinuation(): boolean {
    return sessionStorage.getItem(AccountsService.PENDING_UPGRADE_KEY) === 'true';
  }

  /**
   * Consume the skip flag (returns value and resets to false).
   */
  consumeSkipUpgradeContinuation(): boolean {
    const value = sessionStorage.getItem(AccountsService.SKIP_UPGRADE_KEY) === 'true';
    if (value) {
      console.log('[AccountsService] consumeSkipUpgradeContinuation - was true, resetting');
    }
    sessionStorage.removeItem(AccountsService.SKIP_UPGRADE_KEY);
    return value;
  }

  /**
   * Consume the pending upgrade flag (returns value and resets to false).
   * Call this in chat.page.ts after loading messages to check if we should
   * trigger conversation continuation.
   */
  consumePendingUpgradeContinuation(): boolean {
    const value = sessionStorage.getItem(AccountsService.PENDING_UPGRADE_KEY) === 'true';
    if (value) {
      console.log('[AccountsService] consumePendingUpgradeContinuation - was true, resetting');
    }
    sessionStorage.removeItem(AccountsService.PENDING_UPGRADE_KEY);
    return value;
  }
}

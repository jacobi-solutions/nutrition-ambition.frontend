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

  // Flag to track if user was forced to upgrade from guest (clicked "Create your account" from restricted access)
  // When true, chat.page.ts will call TriggerConversationContinuation to continue any pending actions
  private _forcedUpgradeFromGuest = false;

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
  }

  /**
   * Set flag indicating user was forced to upgrade from guest mode.
   * Call this when user clicks "Create your account" from restricted access message.
   */
  setForcedUpgradeFromGuest(): void {
    console.log('[AccountsService] setForcedUpgradeFromGuest called - setting flag to true');
    this._forcedUpgradeFromGuest = true;
  }

  /**
   * Check if the forced upgrade flag is set without consuming it.
   * Use this to decide navigation strategy in signup.page.ts.
   */
  get isForcedUpgradeFromGuest(): boolean {
    return this._forcedUpgradeFromGuest;
  }

  /**
   * Consume the forced upgrade flag (returns value and resets to false).
   * Call this in chat.page.ts after loading messages to check if we should
   * trigger conversation continuation.
   */
  consumeForcedUpgradeFromGuest(): boolean {
    const value = this._forcedUpgradeFromGuest;
    console.log('[AccountsService] consumeForcedUpgradeFromGuest called - current value:', value);
    this._forcedUpgradeFromGuest = false;
    return value;
  }
} 
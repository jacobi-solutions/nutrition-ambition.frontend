import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';
import { NutritionAmbitionApiService } from './nutrition-ambition-api.service';
import { GetInitialMessageRequest } from './nutrition-ambition-api.service';

@Injectable({
  providedIn: 'root'
})
export class AccountsService {
  private readonly ACCOUNT_ID_KEY = 'nutrition-ambition-accountId';
  private readonly ANONYMOUS_SESSION_COUNT_KEY = 'nutrition-ambition-anonymousSessionCount';
  private accountIdSubject = new BehaviorSubject<string | null>(null);

  constructor(
    private apiService: NutritionAmbitionApiService
  ) {
    // Initialize accountId from storage
    const storedAccountId = this.getAccountId();
    if (storedAccountId) {
      console.log('[AccountsService] Found existing account ID in storage:', storedAccountId);
      this.accountIdSubject.next(storedAccountId);
    } else {
      console.log('[AccountsService] No existing account ID found in storage');
    }
  }

  getAccountId(): string | null {
    const accountId = localStorage.getItem(this.ACCOUNT_ID_KEY);
    return accountId;
  }

  setAccountId(accountId: string): void {
    console.log('[AccountsService] Setting account ID:', accountId);
    localStorage.setItem(this.ACCOUNT_ID_KEY, accountId);
    this.accountIdSubject.next(accountId);
  }

  clearAccountId(): void {
    console.log('[AccountsService] Clearing account ID');
    localStorage.removeItem(this.ACCOUNT_ID_KEY);
    this.accountIdSubject.next(null);
  }

  getAccountIdObservable(): Observable<string | null> {
    return this.accountIdSubject.asObservable();
  }

  getAnonymousSessionCount(): number {
    const count = localStorage.getItem(this.ANONYMOUS_SESSION_COUNT_KEY);
    return count ? parseInt(count, 10) : 0;
  }

  incrementAnonymousSessionCount(): number {
    const currentCount = this.getAnonymousSessionCount();
    const newCount = currentCount + 1;
    localStorage.setItem(this.ANONYMOUS_SESSION_COUNT_KEY, newCount.toString());
    return newCount;
  }

  async initializeAnonymousAccount(): Promise<void> {
    console.log('[AccountsService] Initializing anonymous account');
    
    try {
      // Check if there's already an account ID
      const existingAccountId = this.getAccountId();
      if (existingAccountId) {
        console.log('[AccountsService] Existing accountId found:', existingAccountId);
        this.incrementAnonymousSessionCount();
        return;
      }

      console.log('[AccountsService] No existing accountId, checking localStorage directly');
      // Double-check the localStorage (in case account ID was set by another component/tab)
      const localStorageAccountId = localStorage.getItem(this.ACCOUNT_ID_KEY);
      if (localStorageAccountId) {
        console.log('[AccountsService] Found accountId in localStorage:', localStorageAccountId);
        this.accountIdSubject.next(localStorageAccountId);
        this.incrementAnonymousSessionCount();
        return;
      }

      console.log('[AccountsService] Creating new anonymous account via API');
      try {
        const request = new GetInitialMessageRequest({
          lastLoggedDate: undefined,
          hasLoggedFirstMeal: false
        });
        
        // Make a request to the backend, which will create an anonymous account
        const response = await firstValueFrom(
          this.apiService.getInitialMessage(request)
        );

        console.log('[AccountsService] Initial message response:', response);
        
        if (response.isSuccess) {
          // Check if the accountId was set by the AccountInterceptor
          const accountId = this.getAccountId();
          if (accountId) {
            console.log('[AccountsService] Anonymous account created successfully:', accountId);
          } else {
            console.warn('[AccountsService] No accountId received from backend');
          }
          this.incrementAnonymousSessionCount();
        }
      } catch (error) {
        console.error('[AccountsService] Error creating anonymous account:', error);
      }

      this.incrementAnonymousSessionCount();
    } catch (error) {
      console.error('[AccountsService] Error in initializeAnonymousAccount:', error);
      this.incrementAnonymousSessionCount();
    }
  }
} 
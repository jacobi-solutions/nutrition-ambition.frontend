import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';
import { NutritionAmbitionApiService } from './nutrition-ambition-api.service';

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

    const existingAccountId = this.getAccountId();
    if (existingAccountId) {
      console.log('[AccountsService] Existing accountId found:', existingAccountId);
      this.incrementAnonymousSessionCount();
      return;
    }

    const localStorageAccountId = localStorage.getItem(this.ACCOUNT_ID_KEY);
    if (localStorageAccountId) {
      console.log('[AccountsService] Found accountId in localStorage:', localStorageAccountId);
      this.accountIdSubject.next(localStorageAccountId);
      this.incrementAnonymousSessionCount();
      return;
    }

    console.log('[AccountsService] Deferring anonymous account creation until first message is sent.');
    // Do not call the backend yet – wait for user interaction
  }
} 
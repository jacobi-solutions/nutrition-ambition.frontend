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
      this.accountIdSubject.next(storedAccountId);
    }
  }

  getAccountId(): string | null {
    return localStorage.getItem(this.ACCOUNT_ID_KEY);
  }

  setAccountId(accountId: string): void {
    localStorage.setItem(this.ACCOUNT_ID_KEY, accountId);
    this.accountIdSubject.next(accountId);
  }

  clearAccountId(): void {
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
    try {
      const existingAccountId = this.getAccountId();
      if (existingAccountId) {
        this.incrementAnonymousSessionCount();
        return;
      }

      try {
        const request = new GetInitialMessageRequest({
          lastLoggedDate: undefined,
          hasLoggedFirstMeal: false
        });
        const response = await firstValueFrom(
          this.apiService.getInitialMessage(request)
        );

        if (response.isSuccess) {
          // The account ID will be set by the backend through the FlexibleAuthorize attribute
          // We just need to wait for the next request to get it
          this.incrementAnonymousSessionCount();
        }
      } catch (error) {
        console.error('Error initializing anonymous account:', error);
      }

      this.incrementAnonymousSessionCount();
    } catch (error) {
      console.error('Error in initializeAnonymousAccount:', error);
      this.incrementAnonymousSessionCount();
    }
  }
} 
import { Injectable } from '@angular/core';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { NutritionAmbitionApiService, Account, AccountResponse, Request } from './nutrition-ambition-api.service';

@Injectable({
  providedIn: 'root'
})
export class AccountsService {
  private _accountSubject = new BehaviorSubject<Account | null>(null);
  public account$ = this._accountSubject.asObservable();

  constructor(
    private apiService: NutritionAmbitionApiService
  ) {
    console.log('[AccountsService] Initialized - accountId now comes from Firebase JWT');
  }

  async loadAccount(): Promise<void> {
    try {
      console.log('[AccountsService] Loading account info...');
      const response: AccountResponse = await firstValueFrom(this.apiService.getAccount({} as Request));
      
      if (response.isSuccess && response.account) {
        console.log('[AccountsService] Account loaded successfully:', response.account);
        this._accountSubject.next(response.account);
      } else {
        console.error('[AccountsService] Failed to load account:', response.errors);
        this._accountSubject.next(null);
      }
    } catch (error) {
      console.error('[AccountsService] Error loading account:', error);
      this._accountSubject.next(null);
    }
  }

  get currentAccount(): Account | null {
    return this._accountSubject.value;
  }
} 
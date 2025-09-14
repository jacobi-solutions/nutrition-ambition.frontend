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
} 
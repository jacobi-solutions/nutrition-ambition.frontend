import { Injectable } from '@angular/core';
import { NutritionAmbitionApiService } from './nutrition-ambition-api.service';

@Injectable({
  providedIn: 'root'
})
export class AccountsService {
  constructor(
    private apiService: NutritionAmbitionApiService
  ) {
    console.log('[AccountsService] Initialized - accountId now comes from Firebase JWT');
  }
} 
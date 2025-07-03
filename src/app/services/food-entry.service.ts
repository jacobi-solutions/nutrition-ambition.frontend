import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { NutritionAmbitionApiService, DeleteFoodEntryRequest, DeleteFoodEntryResponse } from './nutrition-ambition-api.service';

@Injectable({
  providedIn: 'root'
})
export class FoodEntryService {
  constructor(
    private apiService: NutritionAmbitionApiService
  ) {}

  /**
   * Delete a food entry by food item IDs
   */
  deleteFoodEntry(foodItemIds: string[]): Observable<DeleteFoodEntryResponse> {
    const request = new DeleteFoodEntryRequest({
      foodItemIds: foodItemIds
    });

    return this.apiService.deleteFoodEntry(request);
  }
} 
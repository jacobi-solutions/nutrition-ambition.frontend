import { Injectable } from '@angular/core';
import { NutritionAmbitionApiService } from './nutrition-ambition-api.service';
import { Observable } from 'rxjs';
import { CreateFoodEntryResponse, GetFoodEntriesResponse, CreateFoodEntryRequest, GetFoodEntriesRequest } from './nutrition-ambition-api.service';

@Injectable({
  providedIn: 'root'
})
export class FoodEntryService {
  constructor(private apiService: NutritionAmbitionApiService) {}

  addFoodEntry(description: string): Observable<CreateFoodEntryResponse> {
    const request = new CreateFoodEntryRequest({
      description: description
    });

    return this.apiService.createFoodEntry(request);
  }

  getDailyEntries(date?: Date): Observable<GetFoodEntriesResponse> {
    const request = new GetFoodEntriesRequest({
      loggedDateUtc: date
      // Add any other required properties here
    });

    return this.apiService.getFoodEntries(request);
  }
}
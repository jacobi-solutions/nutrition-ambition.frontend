import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { 
  NutritionAmbitionApiService, 
  ParseFoodTextRequest,
  NutritionApiResponse,
  GetFoodEntriesRequest,
  GetFoodEntriesResponse
} from './nutrition-ambition-api.service';

@Injectable({
  providedIn: 'root'
})
export class FoodLoggingService {
  constructor(private nutritionApiService: NutritionAmbitionApiService) {}

  /**
   * Processes user-entered food text to obtain nutrition information
   * 
   * @param text The user input text describing foods (e.g., "2 eggs, 1 slice of toast")
   * @returns An Observable of NutritionApiResponse containing nutrition data for the described foods
   */
  processUserInput(text: string): Observable<NutritionApiResponse> {
    const request = new ParseFoodTextRequest({
      foodDescription: text
    });

    return this.nutritionApiService.processFoodTextAndGetNutrition(request)
      .pipe(
        catchError(error => {
          console.error('Error processing food text:', error);
          return throwError(() => new Error('Failed to process food text'));
        })
      );
  }

  /**
   * Uses Smart Nutrition Lookup to get nutrition data for a food description
   * Handles both anonymous and authenticated users
   * 
   * @param text The user input text describing foods
   * @returns An Observable of NutritionApiResponse containing nutrition data from Smart Lookup
   */
  getSmartNutritionData(foodDescription: string): Observable<NutritionApiResponse> {
    const request = new ParseFoodTextRequest({
      foodDescription: foodDescription
    });

    return this.nutritionApiService.getSmartNutritionData(request)
      .pipe(
        catchError(error => {
          console.error('Error getting smart nutrition data:', error);
          return throwError(() => new Error('Failed to get smart nutrition data'));
        })
      );
  }
  
  /**
   * Gets food entries logged for today
   * 
   * @returns An Observable of GetFoodEntriesResponse containing today's food entries
   */
  getFoodEntriesForToday(): Observable<GetFoodEntriesResponse> {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to beginning of the day
    
    const request = new GetFoodEntriesRequest({
      loggedDateUtc: today
    });
    
    return this.nutritionApiService.getFoodEntries(request)
      .pipe(
        catchError(error => {
          console.error('Error getting food entries:', error);
          return throwError(() => new Error('Failed to get food entries'));
        })
      );
  }
} 
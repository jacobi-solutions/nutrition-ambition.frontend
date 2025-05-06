import { Injectable } from '@angular/core';
import { Observable, throwError, of, TimeoutError } from 'rxjs';
import { catchError, timeout, retry, tap } from 'rxjs/operators';
import { 
  NutritionAmbitionApiService, 
  GetFoodEntriesRequest, 
  GetFoodEntriesResponse 
} from './nutrition-ambition-api.service';

@Injectable({
  providedIn: 'root'
})
export class NutritionLogService {
  apiCallCount = 0;
  
  constructor(private nutritionApiService: NutritionAmbitionApiService) {}

  /**
   * Retrieves the food log entries for a specific date
   * @param date The date to retrieve entries for in ISO string format
   * @returns An Observable of GetFoodEntriesResponse containing the log data
   */
  getLogByDate(date: string): Observable<GetFoodEntriesResponse> {
    console.log(`[NutritionLogService] getLogByDate called for date: ${date}. Call #${++this.apiCallCount}`);
    
    const request = new GetFoodEntriesRequest({
      loggedDateUtc: new Date(date)
    });

    return this.nutritionApiService.getFoodEntries(request)
      .pipe(
        tap(() => console.log(`[NutritionLogService] API call completed. Total calls: ${this.apiCallCount}`)),
        timeout(10000), // Add a 10 second timeout
        retry(1), // Retry once if it fails
        catchError(error => {
          if (error instanceof TimeoutError) {
            console.error('[NutritionLogService] Request timed out:', error);
            return throwError(() => new Error('Request timed out. Please try again.'));
          }
          
          console.error('[NutritionLogService] Error loading nutrition log:', error);
          
          // Return an empty response on error to prevent UI from freezing
          const emptyResponse = new GetFoodEntriesResponse({
            foodEntries: [],
            totalCalories: 0,
            totalProtein: 0,
            totalCarbs: 0,
            totalFat: 0,
            isSuccess: false
          });
          
          // Only throw if we really want to show an error to the user
          // otherwise return the empty response to allow the UI to function
          return of(emptyResponse);
        })
      );
  }

  /**
   * Formats the API response into a simplified nutrition summary object
   * @param response The GetFoodEntriesResponse from the API
   * @returns An object with total calories, protein, carbs, and fat
   */
  formatSummary(response: GetFoodEntriesResponse): { 
    totalCalories: number, 
    totalProtein: number, 
    totalCarbs: number, 
    totalFat: number 
  } {
    return {
      totalCalories: response.totalCalories || 0,
      totalProtein: response.totalProtein || 0,
      totalCarbs: response.totalCarbs || 0,
      totalFat: response.totalFat || 0
    };
  }
} 
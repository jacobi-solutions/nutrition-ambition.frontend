import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { 
  NutritionAmbitionApiService, 
  GetFoodEntriesRequest, 
  GetFoodEntriesResponse 
} from './nutrition-ambition-api.service';

@Injectable({
  providedIn: 'root'
})
export class NutritionLogService {
  constructor(private nutritionApiService: NutritionAmbitionApiService) {}

  /**
   * Retrieves the food log entries for a specific date
   * @param date The date to retrieve entries for in ISO string format
   * @returns An Observable of GetFoodEntriesResponse containing the log data
   */
  getLogByDate(date: string): Observable<GetFoodEntriesResponse> {
    const request = new GetFoodEntriesRequest({
      loggedDateUtc: new Date(date)
    });

    return this.nutritionApiService.getFoodEntries(request)
      .pipe(
        catchError(error => {
          console.error('Error loading nutrition log:', error);
          return throwError(() => new Error('Failed to load log'));
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
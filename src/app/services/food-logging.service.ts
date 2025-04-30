import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { 
  NutritionAmbitionApiService, 
  ParseFoodTextRequest,
  NutritionApiResponse
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
} 
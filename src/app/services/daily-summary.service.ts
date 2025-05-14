import { Injectable } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';
import { DateRequest, NutritionAmbitionApiService, NutritionSummaryResponse } from './nutrition-ambition-api.service';
import { AccountsService } from './accounts.service';

@Injectable({
  providedIn: 'root'
})
export class DailySummaryService {
  constructor(
    private apiService: NutritionAmbitionApiService,
    private accountsService: AccountsService
  ) {}

  /**
   * Gets the nutrition summary for a specific date
   * @param loggedDateUtc The date to get the summary for
   * @returns An Observable of the Nutrition Summary response
   */
  getDailySummary(loggedDateUtc: Date = new Date()): Observable<NutritionSummaryResponse> {
    // Create a DateRequest object with the date
    const request = new DateRequest({
      date: loggedDateUtc
    });
    
    return this.apiService.getDailySummary(request)
      .pipe(
        catchError(error => {
          console.error('Error fetching daily summary:', error);
          return throwError(() => new Error('Failed to load daily nutrition summary. Please try again.'));
        })
      );
  }
} 
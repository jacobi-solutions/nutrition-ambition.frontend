import { Injectable } from '@angular/core';
import { Observable, catchError, throwError, of, shareReplay } from 'rxjs';
import { format } from 'date-fns';
import { 
  GetDetailedSummaryRequest,
  GetDetailedSummaryResponse,
  NutritionAmbitionApiService
} from './nutrition-ambition-api.service';
import { DateService } from './date.service';

@Injectable({
  providedIn: 'root'
})
export class DailySummaryService { 
  private detailedSummaryCache: Map<string, Observable<GetDetailedSummaryResponse>> = new Map();
  
  constructor(
    private apiService: NutritionAmbitionApiService,
    private dateService: DateService
  ) {}

  /**
   * Gets the detailed nutrition summary for a specific date
   * @param localDateKey The local date key in yyyy-MM-dd format (from DateService.getSelectedDate())
   * @param forceReload Whether to bypass the cache and force a new API request
   * @returns An Observable of the Detailed Summary response
   */
  getDetailedSummary(localDateKey: string = this.dateService.getSelectedDate(), forceReload: boolean = false): Observable<GetDetailedSummaryResponse> {
    // Use the localDateKey directly as the cache key
    const cacheKey = localDateKey;
    
    // If we're forcing a reload or don't have cached data
    if (forceReload || !this.detailedSummaryCache.has(cacheKey)) {
      
      // Create a GetDetailedSummaryRequest object with the localDateKey
      const request = new GetDetailedSummaryRequest({
        localDateKey: localDateKey
      });
      
      // Make the API call and cache the result
      const apiResponse = this.apiService.getDetailedSummary(request)
        .pipe(
          shareReplay(1), // Cache the result
          catchError(error => {
            this.detailedSummaryCache.delete(cacheKey); // Clear failed result from cache
            return throwError(() => new Error('Failed to load detailed nutrition summary. Please try again.'));
          })
        );
      
      // Store in cache
      this.detailedSummaryCache.set(cacheKey, apiResponse);
    } else {
    }
    
    return this.detailedSummaryCache.get(cacheKey)!;
  }

  /**
   * Clears the cache for a specific date or all cached data
   * @param localDateKey Optional local date key to clear specific cache entry
   */
  clearCache(localDateKey?: string): void {
    if (localDateKey) {
      this.detailedSummaryCache.delete(localDateKey);
    } else {
      this.detailedSummaryCache.clear();
    }
  }
} 
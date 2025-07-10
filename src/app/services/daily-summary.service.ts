import { Injectable } from '@angular/core';
import { Observable, catchError, throwError, of, shareReplay } from 'rxjs';
import { format } from 'date-fns';
import { 
  GetDetailedSummaryRequest,
  GetDetailedSummaryResponse,
  NutritionAmbitionApiService
} from './nutrition-ambition-api.service';

@Injectable({
  providedIn: 'root'
})
export class DailySummaryService {
  private detailedSummaryCache: Map<string, Observable<GetDetailedSummaryResponse>> = new Map();
  
  constructor(
    private apiService: NutritionAmbitionApiService
  ) {}

  /**
   * Gets the detailed nutrition summary for a specific date
   * @param loggedDateUtc The UTC date to get the detailed summary for (from DateService.getSelectedDateUtc())
   * @param forceReload Whether to bypass the cache and force a new API request
   * @returns An Observable of the Detailed Summary response
   */
  getDetailedSummary(loggedDateUtc: Date = new Date(), forceReload: boolean = false): Observable<GetDetailedSummaryResponse> {
    // Generate a cache key based on the local date (yyyy-MM-dd format)
    // This ensures cache is tied to local dates, not UTC boundaries
    const cacheKey = format(loggedDateUtc, 'yyyy-MM-dd');
    
    // If we're forcing a reload or don't have cached data
    if (forceReload || !this.detailedSummaryCache.has(cacheKey)) {
      console.log(`[DailySummaryService] ${forceReload ? 'Force reloading' : 'Loading'} detailed summary for ${cacheKey}`);
      
      // Create a GetDetailedSummaryRequest object with the date
      const request = new GetDetailedSummaryRequest({
        loggedDateUtc: loggedDateUtc
      });
      
      // Make the API call and cache the result
      const apiResponse = this.apiService.getDetailedSummary(request)
        .pipe(
          shareReplay(1), // Cache the result
          catchError(error => {
            console.error('Error fetching detailed summary:', error);
            this.detailedSummaryCache.delete(cacheKey); // Clear failed result from cache
            return throwError(() => new Error('Failed to load detailed nutrition summary. Please try again.'));
          })
        );
      
      // Store in cache
      this.detailedSummaryCache.set(cacheKey, apiResponse);
    } else {
      console.log(`[DailySummaryService] Using cached detailed summary for ${cacheKey}`);
    }
    
    return this.detailedSummaryCache.get(cacheKey)!;
  }

  /**
   * Clears the cache for a specific date or all cached data
   * @param loggedDateUtc Optional UTC date to clear specific cache entry
   */
  clearCache(loggedDateUtc?: Date): void {
    if (loggedDateUtc) {
      // Use local date formatting for cache key consistency
      const cacheKey = format(loggedDateUtc, 'yyyy-MM-dd');
      this.detailedSummaryCache.delete(cacheKey);
      console.log(`[DailySummaryService] Cleared cache for ${cacheKey}`);
    } else {
      this.detailedSummaryCache.clear();
      console.log(`[DailySummaryService] Cleared all cache`);
    }
  }
} 
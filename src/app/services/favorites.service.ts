import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';
import {
  NutritionAmbitionApiService,
  AddFavoriteRequest,
  AddFavoriteResponse,
  RemoveFavoriteRequest,
  RemoveFavoriteResponse,
  GetFavoritesResponse,
  RelogFavoriteRequest,
  RelogFavoriteResponse,
  FavoriteFoodDto
} from './nutrition-ambition-api.service';

@Injectable({
  providedIn: 'root'
})
export class FavoritesService {
  // Cache favorites in memory for quick access
  private favoritesCache$ = new BehaviorSubject<FavoriteFoodDto[]>([]);

  // Expose favorites as observable
  public favorites$ = this.favoritesCache$.asObservable();

  constructor(private apiService: NutritionAmbitionApiService) {}

  /**
   * Load all favorites from the backend
   */
  loadFavorites(): Observable<GetFavoritesResponse> {
    return this.apiService.getFavorites().pipe(
      tap(response => {
        if (response.isSuccess && response.favorites) {
          this.favoritesCache$.next(response.favorites);
        }
      })
    );
  }

  /**
   * Add a food to favorites
   */
  addFavorite(foodEntryId: string, foodId: string, customLabel?: string): Observable<AddFavoriteResponse> {
    const request = new AddFavoriteRequest({
      foodEntryId,
      foodId,
      customLabel
    });

    return this.apiService.addFavorite(request).pipe(
      tap(response => {
        if (response.isSuccess && response.favorite) {
          // Add to cache
          const current = this.favoritesCache$.value;
          this.favoritesCache$.next([response.favorite, ...current]);
        }
      })
    );
  }

  /**
   * Remove a favorite
   */
  removeFavorite(favoriteId: string): Observable<RemoveFavoriteResponse> {
    const request = new RemoveFavoriteRequest({
      favoriteId
    });

    return this.apiService.removeFavorite(request).pipe(
      tap(response => {
        if (response.isSuccess) {
          // Remove from cache
          const current = this.favoritesCache$.value;
          this.favoritesCache$.next(current.filter(f => f.id !== favoriteId));
        }
      })
    );
  }

  /**
   * Re-log a favorite (returns food structure ready for food selection card)
   */
  relogFavorite(favoriteId: string, localDateKey?: string, mealName?: string): Observable<RelogFavoriteResponse> {
    const request = new RelogFavoriteRequest({
      favoriteId,
      localDateKey,
      mealName
    });

    return this.apiService.relogFavorite(request);
  }

  /**
   * Get current favorites from cache
   */
  getCurrentFavorites(): FavoriteFoodDto[] {
    return this.favoritesCache$.value;
  }

  /**
   * Clear favorites cache (e.g., on logout)
   */
  clearCache(): void {
    this.favoritesCache$.next([]);
  }
}

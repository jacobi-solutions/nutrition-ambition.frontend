import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  NutritionAmbitionApiService,
  GetFavoritesRequest,
  GetFavoritesResponse,
  RelogFavoriteRequest,
  RelogFavoriteResponse,
  RemoveFavoriteRequest,
  RemoveFavoriteResponse
} from './nutrition-ambition-api.service';

/**
 * Service for managing food favorites/recents.
 * Simple API wrapper with no caching - components manage their own state.
 */
@Injectable({
  providedIn: 'root'
})
export class FavoritesService {
  constructor(
    private apiService: NutritionAmbitionApiService
  ) {}

  /**
   * Load favorites from the backend.
   * Returns top 40 favorites sorted by score (recency + frequency).
   */
  loadFavorites(): Observable<GetFavoritesResponse> {
    return this.apiService.getFavorites(new GetFavoritesRequest());
  }

  /**
   * Re-log a favorite food.
   * Creates a new Food instance with fresh IDs and increments usage counter.
   */
  relogFavorite(favoriteId: string, localDateKey?: string): Observable<RelogFavoriteResponse> {
    return this.apiService.relogFavorite(
      new RelogFavoriteRequest({ favoriteId, localDateKey })
    );
  }

  /**
   * Remove a favorite from the user's list.
   */
  removeFavorite(favoriteId: string): Observable<RemoveFavoriteResponse> {
    return this.apiService.removeFavorite(
      new RemoveFavoriteRequest({ favoriteId })
    );
  }
}

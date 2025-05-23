import { Injectable } from '@angular/core';
import { NutritionAmbitionApiService, FoodItem, DeleteFoodEntryRequest } from './nutrition-ambition-api.service';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

// Extended FoodItem interface with id property
interface FoodItemWithId extends FoodItem {
  id: string;
}

@Injectable({
  providedIn: 'root'
})
export class FoodLogService {
  private foodItemsSubject = new BehaviorSubject<FoodItemWithId[]>([]);
  private pendingDeletes = new Map<string, any>();

  constructor(private apiService: NutritionAmbitionApiService) {}

  /**
   * Set food items in the behavior subject
   */
  setFoodItems(items: FoodItemWithId[]): void {
    this.foodItemsSubject.next(items);
  }

  /**
   * Get observable of food items
   */
  getFoodItems$(): Observable<FoodItemWithId[]> {
    return this.foodItemsSubject.asObservable();
  }

  /**
   * Delete a food entry item by ID
   * @deprecated Use deleteFoodEntryItems instead
   */
  deleteFoodEntryItem(id: string): Observable<void> {
    return this.deleteFoodEntryItems([id]);
  }

  /**
   * Delete multiple food entry items by IDs
   */
  deleteFoodEntryItems(ids: string[]): Observable<void> {
    const request = new DeleteFoodEntryRequest({
      foodItemIds: ids,
      accountId: undefined, // These will be filled by interceptors
      isAnonymousUser: undefined
    });

    return this.apiService.deleteFoodEntry(request).pipe(
      map(() => void 0),
      catchError(error => {
        console.error('Error deleting food items:', error);
        return of(void 0);
      })
    );
  }

  /**
   * Optimistically remove a food item and schedule its deletion
   */
  removeFoodItemOptimistically(food: FoodItemWithId): void {
    if (!food || !food.id) {
      console.error('Cannot remove food item without an ID');
      return;
    }
    
    this.foodItemsSubject.next(
      this.foodItemsSubject.value.filter(f => f.id !== food.id)
    );
    
    this.pendingDeletes.set(food.id, {
      item: food,
      timeout: setTimeout(() => this.confirmDelete(food.id), 4000)
    });
  }

  /**
   * Undo removal of a food item
   */
  undoRemoveFoodItem(foodId: string): void {
    const pending = this.pendingDeletes.get(foodId);
    if (pending) {
      clearTimeout(pending.timeout);
      this.foodItemsSubject.next([
        ...this.foodItemsSubject.value,
        pending.item
      ]);
      this.pendingDeletes.delete(foodId);
    }
  }

  /**
   * Confirm deletion of a food item
   */
  private confirmDelete(foodId: string): void {
    const pending = this.pendingDeletes.get(foodId);
    if (!pending) return;

    this.deleteFoodEntryItem(foodId).subscribe({
      error: () => {
        // If API fails, re-add item
        this.foodItemsSubject.next([
          ...this.foodItemsSubject.value,
          pending.item
        ]);
      }
    });

    this.pendingDeletes.delete(foodId);
  }
} 
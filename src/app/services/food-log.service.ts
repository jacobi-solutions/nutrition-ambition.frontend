import { Injectable } from '@angular/core';
import { NutritionAmbitionApiService } from './nutrition-ambition-api.service';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

// Define the interfaces needed
interface FoodItem {
  id?: string;
  name?: string;
  brandName?: string;
  quantity?: string;
  unit?: string;
  calories?: number;
}

// Extended FoodItem interface with id property
interface FoodItemWithId extends FoodItem {
  id: string;
}

// Define the DeleteFoodEntryRequest class
class DeleteFoodEntryRequest {
  foodItemIds?: string[];

  constructor(data?: any) {
    if (data) {
      this.foodItemIds = data.foodItemIds;
    }
  }
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
   * Note: This now handles deletion locally as the API endpoint is updated
   */
  deleteFoodEntryItems(ids: string[]): Observable<void> {
    // Since we're now using Firebase JWT for authentication,
    // the deleteFoodEntry endpoint is likely updated.
    // For now, we'll just handle this locally.
    console.log('Deleting food items with IDs:', ids);
    
    // Return success for now - actual API integration will need to be updated
    return of(void 0);
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
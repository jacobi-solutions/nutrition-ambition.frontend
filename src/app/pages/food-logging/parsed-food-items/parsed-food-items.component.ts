import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { finalize } from 'rxjs/operators';
import { MealItem, NutritionAmbitionApiService } from 'src/app/services/nutrition-ambition-api.service';

@Component({
  selector: 'app-parsed-food-items',
  templateUrl: './parsed-food-items.component.html',
  styleUrls: ['./parsed-food-items.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule]
})
export class ParsedFoodItemsComponent implements OnInit {
  @Input() parsedFoodData: any;
  @Output() nutritionData = new EventEmitter<any>();
  
  foodItems: MealItem[] = [];
  isLoading: boolean = false;
  errorMessage: string = '';

  constructor(private nutritionApiService: NutritionAmbitionApiService) { }

  ngOnInit() {
    this.initializeFoodItems();
  }

  ngOnChanges() {
    this.initializeFoodItems();
  }

  initializeFoodItems() {
    if (this.parsedFoodData && this.parsedFoodData.mealItems) {
      this.foodItems = [...this.parsedFoodData.mealItems];
    }
  }

  updateQuantity(index: number, event: any) {
    this.foodItems[index].quantity = event.detail.value;
  }

  updateUnit(index: number, event: any) {
    //this.foodItems[index].unit = event.detail.value;
  }

  removeItem(index: number) {
    this.foodItems.splice(index, 1);
  }

  addNewItem() {
    // this.foodItems.push({
    //   foodName: '',
    //   quantity: '1',
    //   unit: 'serving',
    //   isNew: true
    // });
  }

  getNutritionData() {
    if (this.foodItems.length === 0) {
      this.errorMessage = 'No food items to analyze';
      return;
    }

    this.errorMessage = '';
    this.isLoading = true;

    // Create a copy of the parsed food data with updated items
    const updatedFoodData = {
      ...this.parsedFoodData,
      parsedFood: this.foodItems
    };

    this.nutritionApiService.getNutritionData(updatedFoodData)
      .pipe(
        finalize(() => this.isLoading = false)
      )
      .subscribe({
        next: (response) => {
          if (response && response.isSuccess) {
            this.nutritionData.emit(response);
          } else {
            this.errorMessage = 'Failed to get nutrition data. Please try again.';
          }
        },
        error: (error) => {
          console.error('Error getting nutrition data:', error);
          this.errorMessage = 'An error occurred while getting nutrition data. Please try again.';
        }
      });
  }
}

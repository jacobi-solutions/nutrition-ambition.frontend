import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ModalController } from '@ionic/angular';
import { FoodEntry, FoodItem } from 'src/app/services/nutrition-ambition-api.service';
import { NutritionVisualizationComponent } from 'src/app/pages/food-logging/nutrition-visualization/nutrition-visualization.component'; // Import the visualization component

@Component({
  selector: 'app-food-entry-detail-modal',
  templateUrl: './food-entry-detail.modal.html',
  styleUrls: ['./food-entry-detail.modal.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule] // Import IonicModule and CommonModule
})
export class FoodEntryDetailModalComponent implements OnInit {

  @Input() foodEntry!: FoodEntry; // Receive the full FoodEntry object

  constructor(
    private modalCtrl: ModalController,
    private nestedModalCtrl: ModalController // Use a separate instance for nested modal
    ) { }

  ngOnInit() {
    // Log received data for debugging
    // console.log('Food Entry Detail Modal Init:', this.foodEntry);
  }

  dismiss() {
    this.modalCtrl.dismiss();
  }

  // Method to open the nutrition visualization modal for a specific FoodItem
  async viewFoodItemDetails(foodItem: FoodItem) {
    // We need to map the simple FoodItem back to a structure NutritionVisualizationComponent expects
    // It expects a NutritionApiResponse structure or similar containing 'foods'
    // Let's create a mock response structure for this single item
    const mockNutritionData = {
      foods: [{
        name: foodItem.name,
        quantity: foodItem.quantity?.toString() ?? '1',
        unit: foodItem.unit,
        calories: foodItem.calories,
        macronutrients: {
          protein: { amount: foodItem.protein ?? 0, unit: 'g' },
          carbohydrates: { amount: foodItem.carbohydrates ?? 0, unit: 'g' },
          fat: { amount: foodItem.fat ?? 0, unit: 'g' },
          // Add other macros if available in FoodItem model and needed by visualization
          fiber: { amount: 0, unit: 'g' }, // Placeholder
          sugar: { amount: 0, unit: 'g' }, // Placeholder
          saturatedFat: { amount: 0, unit: 'g' } // Placeholder
        },
        micronutrients: Object.entries(foodItem.micronutrients ?? {}).reduce((acc, [key, value]) => {
          acc[key] = { amount: value, unit: 'mg' }; // Assuming mg, adjust if unit info is stored
          return acc;
        }, {} as { [key: string]: { amount: number, unit: string } })
      }]
    };

    const modal = await this.nestedModalCtrl.create({
      component: NutritionVisualizationComponent,
      componentProps: {
        nutritionData: mockNutritionData // Pass the mapped data
      }
    });
    await modal.present();
  }
}


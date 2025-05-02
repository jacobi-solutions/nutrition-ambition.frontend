import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, AlertController } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { FoodEntry, FoodGroup, FoodItem } from 'src/app/services/nutrition-ambition-api.service';
import { finalize } from 'rxjs/operators';

// Import NutritionLogService
import { NutritionLogService } from 'src/app/services/nutrition-log.service';
import { AppHeaderComponent } from '../../components/app-header/app-header.component';

// Define a type for nutrient property for type safety
type NutrientProperty = 'calories' | 'protein' | 'carbohydrates' | 'fat' | 'Fiber' | 'Sugar';

// Define an interface for nutrient contributions
interface NutrientContribution {
  foodName: string;
  groupName: string;
  amount: number;
  unit: string;
  percentage: number;
}

@Component({
  selector: 'app-nutrition-log',
  templateUrl: './nutrition-log.page.html',
  styleUrls: ['./nutrition-log.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonicModule,
    FormsModule,
    AppHeaderComponent
  ]
})
export class NutritionLogPage implements OnInit {

  selectedDate: string = new Date().toISOString();
  isLoading: boolean = false;
  errorMessage: string = '';
  foodEntries: FoodEntry[] = [];
  dailySummary: any = null;
  
  // Nutrient tracking properties
  totalCalories: number = 0;
  totalProtein: number = 0;
  totalCarbs: number = 0;
  totalFat: number = 0;
  totalFiber: number = 0;
  totalSugar: number = 0;
  
  // Track all nutrients for display
  nutrients = [
    { name: 'Calories', value: 0, unit: 'kcal', property: 'calories' },
    { name: 'Protein', value: 0, unit: 'g', property: 'protein' },
    { name: 'Carbs', value: 0, unit: 'g', property: 'carbohydrates' },
    { name: 'Fat', value: 0, unit: 'g', property: 'fat' },
    { name: 'Fiber', value: 0, unit: 'g', property: 'fiber' },
    { name: 'Sugar', value: 0, unit: 'g', property: 'sugar' }
  ];
  
  // Selected nutrient for breakdown
  selectedNutrient: string | null = null;
  nutrientContributions: NutrientContribution[] = [];

  constructor(
    private nutritionLogService: NutritionLogService,
    private router: Router,
    private alertController: AlertController
  ) { }

  ngOnInit() {
    this.loadLogData();
  }
  
  ionViewWillEnter() {
    // Load today's data when the page is about to become active
    this.loadLogData();
  }

  dateChanged(event: any) {
    this.selectedDate = event.detail.value;
    this.loadLogData();
  }

  loadLogData() {
    this.isLoading = true;
    this.errorMessage = '';
    this.foodEntries = [];
    this.dailySummary = null;
    
    // Reset nutrients
    this.nutrients.forEach(nutrient => nutrient.value = 0);

    this.nutritionLogService.getLogByDate(this.selectedDate)
      .pipe(finalize(() => this.isLoading = false))
      .subscribe({
        next: (response) => {
          this.foodEntries = response.foodEntries || [];
          this.dailySummary = this.nutritionLogService.formatSummary(response);
          
          // Update totals from response
          this.totalCalories = response.totalCalories || 0;
          this.totalProtein = response.totalProtein || 0;
          this.totalCarbs = response.totalCarbs || 0;
          this.totalFat = response.totalFat || 0;
          
          // Update the nutrients array with the values
          this.nutrients[0].value = this.totalCalories;
          this.nutrients[1].value = this.totalProtein;
          this.nutrients[2].value = this.totalCarbs;
          this.nutrients[3].value = this.totalFat;
          
          // Calculate additional nutrients
          this.calculateAdditionalNutrients();
        },
        error: (err) => {
          console.error('Error loading log:', err);
          this.errorMessage = err?.message || 'Failed to load log data.';
        }
      });
  }
  
  /**
   * Calculate additional nutrients (fiber, sugar, etc.) from food items
   */
  calculateAdditionalNutrients() {
    let totalFiber = 0;
    let totalSugar = 0;
    
    // Loop through all food entries and their items
    this.foodEntries.forEach(entry => {
      if (entry.groupedItems) {
        entry.groupedItems.forEach(group => {
          if (group.items) {
            group.items.forEach(item => {
              // Add fiber and sugar if available in the micronutrients
              if (item.micronutrients) {
                if (item.micronutrients['Fiber']) {
                  totalFiber += item.micronutrients['Fiber'];
                }
                if (item.micronutrients['Sugar']) {
                  totalSugar += item.micronutrients['Sugar'];
                }
              }
            });
          }
        });
      }
    });
    
    this.totalFiber = totalFiber;
    this.totalSugar = totalSugar;
    
    // Update the nutrients array
    this.nutrients[4].value = totalFiber;
    this.nutrients[5].value = totalSugar;
  }
  
  /**
   * View foods contributing to a specific nutrient
   * @param nutrientName The name of the nutrient to analyze
   */
  async viewFoodsForNutrient(nutrientName: string) {
    this.selectedNutrient = nutrientName;
    this.nutrientContributions = [];
    
    // Define known nutrient properties
    let property: NutrientProperty;
    
    // Map the nutrient name to its corresponding property
    switch (nutrientName) {
      case 'Calories': property = 'calories'; break;
      case 'Protein': property = 'protein'; break;
      case 'Carbs': property = 'carbohydrates'; break;
      case 'Fat': property = 'fat'; break;
      case 'Fiber': property = 'Fiber'; break;
      case 'Sugar': property = 'Sugar'; break;
      default:
        console.error(`Unknown nutrient: ${nutrientName}`);
        return;
    }
    
    // Find the total for this nutrient
    const totalAmount = this.nutrients.find(n => n.name === nutrientName)?.value || 0;
    if (totalAmount <= 0) {
      // No data for this nutrient
      const alert = await this.alertController.create({
        header: `${nutrientName} Breakdown`,
        message: `No ${nutrientName.toLowerCase()} data available for today's food entries.`,
        buttons: ['OK']
      });
      
      await alert.present();
      return;
    }
    
    // Calculate contributions for each food item
    this.foodEntries.forEach(entry => {
      if (entry.groupedItems) {
        entry.groupedItems.forEach(group => {
          if (group.items) {
            group.items.forEach(item => {
              let amount = 0;
              let unit = property === 'calories' ? 'kcal' : 'g';
              
              // Check if this is a micronutrient or a main property
              if (['Fiber', 'Sugar'].includes(property)) {
                // These are in the micronutrients object
                if (item.micronutrients && property in item.micronutrients) {
                  amount = Number(item.micronutrients[property as string]);
                }
              } else {
                // These are direct properties
                amount = Number((item as any)[property]) || 0;
              }
              
              if (amount > 0) {
                const percentage = (amount / totalAmount) * 100;
                
                this.nutrientContributions.push({
                  foodName: `${item.quantity} ${item.unit} ${item.name}`,
                  groupName: group.groupName || '',
                  amount,
                  unit,
                  percentage
                });
              }
            });
          }
        });
      }
    });
    
    // Sort by contribution amount (descending)
    this.nutrientContributions.sort((a, b) => b.amount - a.amount);
    
    // Create a message with the contributions
    let message = '<div class="nutrient-breakdown">';
    
    this.nutrientContributions.forEach(contribution => {
      message += `<div class="breakdown-item">
        <div class="item-name">${contribution.foodName}</div>
        <div class="item-amount">${contribution.amount.toFixed(1)}${contribution.unit} (${contribution.percentage.toFixed(1)}%)</div>
      </div>`;
    });
    
    message += '</div>';
    
    // Show an alert with the breakdown
    const alert = await this.alertController.create({
      header: `${nutrientName} Breakdown (${totalAmount.toFixed(1)}${property === 'calories' ? 'kcal' : 'g'})`,
      message: message,
      cssClass: 'nutrient-alert',
      buttons: ['Close']
    });
    
    await alert.present();
  }

  // Updated to navigate to the FoodGroupDetailPage
  viewGroupDetails(entry: FoodEntry, group: FoodGroup) {
    this.router.navigate(['/food-group-detail'], {
      state: {
        groupName: group.groupName,
        items: group.items,
        entryTime: entry.loggedDateUtc
      }
    });
  }

  previousDay() {
    const currentDate = new Date(this.selectedDate);
    currentDate.setDate(currentDate.getDate() - 1);
    this.selectedDate = currentDate.toISOString();
    this.loadLogData();
  }

  nextDay() {
    const currentDate = new Date(this.selectedDate);
    currentDate.setDate(currentDate.getDate() + 1);
    this.selectedDate = currentDate.toISOString();
    this.loadLogData();
  }

  // Helper function to calculate total calories for a single FoodEntry using GroupedItems
  calculateEntryCalories(entry: FoodEntry): number {
    if (!entry || !entry.groupedItems) {
      return 0;
    }
    return entry.groupedItems.reduce((groupSum, group) => 
      groupSum + (group.items?.reduce((itemSum, item) => itemSum + (item.calories || 0), 0) || 0),
      0);
  }

  // Calculate total protein for a group
  calculateGroupProtein(group: FoodGroup): number {
    if (!group || !group.items) {
      return 0;
    }
    return group.items.reduce((sum, item) => sum + (item.protein || 0), 0);
  }

  // Calculate total carbs for a group
  calculateGroupCarbs(group: FoodGroup): number {
    if (!group || !group.items) {
      return 0;
    }
    return group.items.reduce((sum, item) => sum + (item.carbohydrates || 0), 0);
  }

  // Calculate total fat for a group
  calculateGroupFat(group: FoodGroup): number {
    if (!group || !group.items) {
      return 0;
    }
    return group.items.reduce((sum, item) => sum + (item.fat || 0), 0);
  }

  // Calculate total calories for a group
  calculateGroupCalories(group: FoodGroup): number {
    if (!group || !group.items) {
      return 0;
    }
    return group.items.reduce((sum, item) => sum + (item.calories || 0), 0);
  }
}


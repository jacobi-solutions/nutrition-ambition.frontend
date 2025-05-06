import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, AlertController } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { FoodEntry, FoodGroup, FoodItem, DailySummaryResponse } from 'src/app/services/nutrition-ambition-api.service';
import { finalize, takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';

// Import NutritionLogService
import { NutritionLogService } from 'src/app/services/nutrition-log.service';
import { AppHeaderComponent } from '../../components/app-header/app-header.component';
import { DailySummaryCardComponent } from '../../components/daily-summary-card/daily-summary-card.component';

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
    AppHeaderComponent,
    DailySummaryCardComponent
  ]
})
export class NutritionLogPage implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private hasLoadedData = false;
  
  selectedDate: string = new Date().toISOString();
  isLoading: boolean = false;
  errorMessage: string = '';
  foodEntries: FoodEntry[] = [];
  dailySummary: DailySummaryResponse | null = null;
  
  // Properties for daily-summary-card
  get dateObject(): Date | null {
    return this.selectedDate ? new Date(this.selectedDate) : null;
  }
  
  get isSelectedDateToday(): boolean {
    if (!this.selectedDate) return false;
    const today = new Date();
    const selected = new Date(this.selectedDate);
    return today.getFullYear() === selected.getFullYear() &&
           today.getMonth() === selected.getMonth() &&
           today.getDate() === selected.getDate();
  }
  
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
    // Don't load data in ngOnInit - will be loaded in ionViewWillEnter
    console.log('[DEBUG] ngOnInit called');
  }
  
  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    console.log('[DEBUG] ngOnDestroy called');
  }
  
  ionViewWillEnter() {
    // Load data only if not already loading and not already loaded
    console.log('[DEBUG] ionViewWillEnter called, hasLoadedData:', this.hasLoadedData, 'isLoading:', this.isLoading);
    if (!this.isLoading && !this.hasLoadedData) {
      this.loadLogData();
    }
  }

  dateChanged(event: any) {
    console.log('[DEBUG] dateChanged event:', event);
    this.selectedDate = event.detail.value;
    this.loadLogData();
  }

  loadLogData() {
    console.log('[DEBUG] loadLogData starting for date:', this.selectedDate);
    
    if (this.isLoading) {
      console.log('[DEBUG] Already loading data, skipping request');
      return;
    }
    
    this.isLoading = true;
    this.errorMessage = '';
    this.foodEntries = [];
    this.dailySummary = null;
    this.hasLoadedData = false;
    
    // Reset nutrients
    this.nutrients.forEach(nutrient => nutrient.value = 0);

    this.nutritionLogService.getLogByDate(this.selectedDate)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          console.log('[DEBUG] API call completed, setting isLoading = false');
          this.isLoading = false;
          this.hasLoadedData = true;
        })
      )
      .subscribe({
        next: (response) => {
          console.log('[DEBUG] Received response data:', response);
          
          this.foodEntries = response.foodEntries || [];
          
          // Create DailySummaryResponse object using fromJS
          this.dailySummary = DailySummaryResponse.fromJS({
            totalCalories: response.totalCalories || 0,
            totalProtein: response.totalProtein || 0,
            totalCarbohydrates: response.totalCarbs || 0,
            totalFat: response.totalFat || 0,
            totalSaturatedFat: 0, // Will calculate in additional nutrients
            totalMicronutrients: {},
            isSuccess: true
          });
          
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
          
          // Calculate additional nutrients - do this in a non-blocking way
          setTimeout(() => this.calculateAdditionalNutrients(), 0);
          
          console.log('[DEBUG] Data processing complete');
        },
        error: (err) => {
          console.error('[DEBUG] Error loading log:', err);
          this.errorMessage = err?.message || 'Failed to load log data.';
        }
      });
  }
  
  /**
   * Calculate additional nutrients (fiber, sugar, etc.) from food items
   * Optimized to reduce performance impact
   */
  calculateAdditionalNutrients() {
    console.log('[DEBUG] Starting additional nutrient calculations');
    
    // Early return if no food entries to avoid unnecessary processing
    if (!this.foodEntries || this.foodEntries.length === 0) {
      console.log('[DEBUG] No food entries to process, skipping calculations');
      return;
    }
    
    let totalFiber = 0;
    let totalSugar = 0;
    let totalSaturatedFat = 0;
    const micronutrients: Record<string, number> = {};
    
    // Loop through all food entries and their items - use a more performant approach
    for (const entry of this.foodEntries) {
      if (entry.groupedItems) {
        for (const group of entry.groupedItems) {
          if (group.items) {
            for (const item of group.items) {
              const quantity = item.quantity || 1;
              
              // Add saturated fat
              if (item.saturatedFat) {
                totalSaturatedFat += item.saturatedFat * quantity;
              }
              
              // Add fiber and sugar if available in the micronutrients
              if (item.micronutrients) {
                if (item.micronutrients['Fiber']) {
                  totalFiber += item.micronutrients['Fiber'] * quantity;
                }
                if (item.micronutrients['Sugar']) {
                  totalSugar += item.micronutrients['Sugar'] * quantity;
                }
                
                // Only process specific micronutrients we need
                for (const key of Object.keys(item.micronutrients)) {
                  if (micronutrients[key]) {
                    micronutrients[key] += item.micronutrients[key] * quantity;
                  } else {
                    micronutrients[key] = item.micronutrients[key] * quantity;
                  }
                }
              }
            }
          }
        }
      }
    }
    
    this.totalFiber = totalFiber;
    this.totalSugar = totalSugar;
    
    // Update the nutrients array
    this.nutrients[4].value = totalFiber;
    this.nutrients[5].value = totalSugar;
    
    // Update the dailySummary object
    if (this.dailySummary) {
      this.dailySummary.totalSaturatedFat = totalSaturatedFat;
      this.dailySummary.totalMicronutrients = micronutrients;
    }
    
    console.log('[DEBUG] Completed additional nutrient calculations');
  }
  
  /**
   * Handles navigating to log view (same page, different presentation)
   */
  goToLog() {
    // We're already on the log page, so no navigation needed
    // Could scroll to entry section if desired
    const entrySection = document.querySelector('.logged-entries');
    if (entrySection) {
      entrySection.scrollIntoView({ behavior: 'smooth' });
    }
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
    
    // Calculate contributions - optimize by pre-filtering and reducing array operations
    for (const entry of this.foodEntries) {
      if (entry.groupedItems) {
        for (const group of entry.groupedItems) {
          if (group.items) {
            for (const item of group.items) {
              let amount = 0;
              let unit = property === 'calories' ? 'kcal' : 'g';
              
              // Check if this is a micronutrient or a main property
              if (['Fiber', 'Sugar'].includes(property)) {
                // These are in the micronutrients object
                if (item.micronutrients && property in item.micronutrients) {
                  amount = Number(item.micronutrients[property as string]) * (item.quantity || 1);
                }
              } else {
                // These are direct properties
                amount = Number((item as any)[property]) * (item.quantity || 1) || 0;
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
            }
          }
        }
      }
    }
    
    // Sort by contribution amount (descending)
    this.nutrientContributions.sort((a, b) => b.amount - a.amount);
    
    // Limit to top 20 contributors to improve performance
    const topContributions = this.nutrientContributions.slice(0, 20);
    
    // Create a message with the contributions
    let message = '<div class="nutrient-breakdown">';
    
    topContributions.forEach(contribution => {
      message += `<div class="breakdown-item">
        <div class="item-name">${contribution.foodName}</div>
        <div class="item-amount">${contribution.amount.toFixed(1)}${contribution.unit} (${contribution.percentage.toFixed(1)}%)</div>
      </div>`;
    });
    
    if (this.nutrientContributions.length > 20) {
      message += `<div class="breakdown-item">
        <div class="item-name">... and ${this.nutrientContributions.length - 20} more items</div>
      </div>`;
    }
    
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

  /**
   * View details of a specific food group
   * @param entry The food entry containing the group
   * @param group The food group to view
   */
  async viewGroupDetails(entry: FoodEntry, group: FoodGroup) {
    // Navigate to food group detail page
    await this.router.navigate(['/food-group-detail'], {
      state: {
        entry: entry,
        group: group
      }
    });
  }

  previousDay() {
    const date = new Date(this.selectedDate);
    date.setDate(date.getDate() - 1);
    this.selectedDate = date.toISOString();
    this.hasLoadedData = false;
    this.loadLogData();
  }

  nextDay() {
    const date = new Date(this.selectedDate);
    date.setDate(date.getDate() + 1);
    this.selectedDate = date.toISOString();
    this.hasLoadedData = false;
    this.loadLogData();
  }

  // Helper methods to calculate nutritional data for display
  calculateEntryCalories(entry: FoodEntry): number {
    return entry.groupedItems?.reduce((sum, group) => sum + this.calculateGroupCalories(group), 0) || 0;
  }

  calculateGroupProtein(group: FoodGroup): number {
    return group.items?.reduce((sum, item) => sum + (item.protein || 0) * (item.quantity || 1), 0) || 0;
  }

  calculateGroupCarbs(group: FoodGroup): number {
    return group.items?.reduce((sum, item) => sum + (item.carbohydrates || 0) * (item.quantity || 1), 0) || 0;
  }

  calculateGroupFat(group: FoodGroup): number {
    return group.items?.reduce((sum, item) => sum + (item.fat || 0) * (item.quantity || 1), 0) || 0;
  }

  calculateGroupCalories(group: FoodGroup): number {
    return group.items?.reduce((sum, item) => sum + (item.calories || 0) * (item.quantity || 1), 0) || 0;
  }
}


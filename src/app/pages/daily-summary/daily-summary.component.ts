import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { 
  IonContent, 
  IonHeader, 
  IonToolbar, 
  IonTitle,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonSpinner,
  IonText,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonList,
  IonItem,
  IonIcon,
  IonAccordion,
  IonAccordionGroup,
  IonNote,
  IonButton
} from '@ionic/angular/standalone';
import { FormsModule } from '@angular/forms';
import { 
  NutritionSummaryResponse, 
  GetDetailedSummaryResponse, 
  NutrientBreakdown, 
  FoodBreakdown,
  NutrientContribution,
  FoodContribution
} from '../../services/nutrition-ambition-api.service';
import { catchError, finalize, of, Subscription } from 'rxjs';
import { DailySummaryService } from 'src/app/services/daily-summary.service';
import { AccountsService } from 'src/app/services/accounts.service';
import { AuthService } from 'src/app/services/auth.service';
import { DateService } from 'src/app/services/date.service';
import { MacronutrientsSummary } from '../../services/nutrition-ambition-api.service';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import { chevronDownOutline, chevronForwardOutline, closeOutline } from 'ionicons/icons';
import { ChatService } from 'src/app/services/chat.service';
import { AppHeaderComponent } from 'src/app/components/header/header.component';

@Component({
  selector: 'app-daily-summary',
  templateUrl: './daily-summary.component.html',
  styleUrls: ['./daily-summary.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonContent,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonSpinner,
    IonText,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    IonList,
    IonItem,
    AppHeaderComponent
  ]
})
export class DailySummaryComponent implements OnInit, OnDestroy {
  summaryData: NutritionSummaryResponse | null = null;
  detailedData: GetDetailedSummaryResponse | null = null;
  viewMode: 'nutrients' | 'foods' = 'nutrients';
  selectedNutrient: NutrientBreakdown | null = null;
  selectedFood: FoodBreakdown | null = null;
  loading = false;
  detailedLoading = false;
  error: string | null = null;
  detailedError: string | null = null;
  isEmptySummary = false;
  selectedDate: string = new Date().toISOString();
  userEmail: string | null = null;
  private dateSubscription: Subscription;
  private mealLoggedSubscription: Subscription;
  
  // List of recognized macronutrient names (case-insensitive)
  private readonly macronutrientNames: string[] = [
    'calories', 'calorie',
    'protein', 'proteins',
    'carbohydrate', 'carbohydrates', 'carbs', 'carb',
    'fat', 'fats',
    'fiber', 'fibre',
    'sugar', 'sugars',
    'saturated fat', 'saturatedfat',
    'unsaturated fat', 'unsaturatedfat',
    'trans fat', 'transfat',
    'cholesterol'
  ];
  
  // Use the inject function for dependency injection in standalone components
  private dailySummaryService = inject(DailySummaryService);
  private accountsService = inject(AccountsService);
  private authService = inject(AuthService);
  private dateService = inject(DateService);
  private chatService = inject(ChatService);
  private router = inject(Router);

  constructor() {
    addIcons({ chevronDownOutline, chevronForwardOutline, closeOutline });
  }

  ngOnInit() {
    // Subscribe to date changes
    this.dateSubscription = this.dateService.selectedDate$.subscribe(date => {
      this.selectedDate = date;
      this.loadSummary(new Date(date));
      this.loadDetailedSummary(new Date(date));
    });
    
    // Subscribe to meal logged events from ChatService
    this.mealLoggedSubscription = this.chatService.mealLogged$.subscribe(() => {
      console.log('[DailySummary] Meal logged event received, reloading summary data');
      this.loadSummary(new Date(this.selectedDate));
      this.loadDetailedSummary(new Date(this.selectedDate));
    });
    
    // Get the current user email
    this.authService.userEmail$.subscribe(email => {
      this.userEmail = email;
    });
  }
  
  ngOnDestroy() {
    // Clean up subscriptions
    if (this.dateSubscription) {
      this.dateSubscription.unsubscribe();
    }
    if (this.mealLoggedSubscription) {
      this.mealLoggedSubscription.unsubscribe();
    }
  }
  
  // Handle date changes from the header
  onDateChanged(newDate: string) {
    console.log(`[DailySummary] Date changed to: ${newDate}`);
    
    // Update local value first
    this.selectedDate = newDate;
    
    // Then update the service
    this.dateService.setSelectedDate(newDate);
  }
  
  // Handle navigation to previous day
  onPreviousDay() {
    console.log(`[DailySummary] Previous day clicked, current date is: ${this.selectedDate}`);
    this.dateService.goToPreviousDay();
  }
  
  // Handle navigation to next day
  onNextDay() {
    console.log(`[DailySummary] Next day clicked, current date is: ${this.selectedDate}`);
    this.dateService.goToNextDay();
  }
  
  // Handle login
  onLogin() {
    this.router.navigate(['/login']);
  }
  
  // Handle logout
  onLogout() {
    this.authService.signOutUser().then(() => {
      // Optional: navigate somewhere or reload
      window.location.reload();
    });
  }

  // Handle segment change
  segmentChanged(event: any) {
    this.viewMode = event.detail.value;
    // Reset selected items when changing view
    this.clearSelection();
  }

  // Handle nutrient selection
  selectNutrient(nutrient: NutrientBreakdown) {
    this.selectedNutrient = this.selectedNutrient?.name === nutrient.name ? null : nutrient;
    this.selectedFood = null;
  }

  // Handle food selection
  selectFood(food: FoodBreakdown) {
    this.selectedFood = this.selectedFood?.name === food.name ? null : food;
    this.selectedNutrient = null;
  }
  
  // Clear all selections
  clearSelection() {
    this.selectedNutrient = null;
    this.selectedFood = null;
  }

  // Get macronutrients list from detailed data
  get macronutrientList(): NutrientBreakdown[] {
    if (!this.detailedData?.nutrients) {
      return [];
    }
    
    return this.detailedData.nutrients.filter(nutrient => 
      this.isMacronutrient(nutrient.name || '')
    );
  }
  
  // Get micronutrients list from detailed data
  get micronutrientList(): NutrientBreakdown[] {
    if (!this.detailedData?.nutrients) {
      return [];
    }
    
    return this.detailedData.nutrients.filter(nutrient => 
      !this.isMacronutrient(nutrient.name || '')
    );
  }
  
  // Helper to determine if a nutrient is a macronutrient
  private isMacronutrient(name: string): boolean {
    if (!name) return false;
    
    const lowerName = name.toLowerCase();
    return this.macronutrientNames.some(macro => 
      lowerName === macro || lowerName.includes(macro)
    );
  }

  loadSummary(date: Date) {
    console.log('[DailySummary] Loading summary data for date:', date);
    
    // Check for account ID - if missing, show empty summary
    const accountId = this.accountsService.getAccountId();
    if (!accountId) {
      this.createEmptySummary();
      return;
    }
    
    this.loading = true;
    this.error = null;
    this.summaryData = null; // Reset summary data
    this.isEmptySummary = false;

    this.dailySummaryService.getDailySummary(date, true) // Pass true to force reload from backend
      .pipe(
        catchError(error => {
          console.error('Error loading daily summary:', error);
          this.error = 'Unable to load nutrition summary. Please try again later.';
          return of(null as NutritionSummaryResponse | null);
        }),
        finalize(() => {
          this.loading = false;
        })
      )
      .subscribe({
        next: (result: NutritionSummaryResponse | null) => {
          if (result) {
            this.summaryData = result;
          } else {
            // No data returned, create empty summary
            this.createEmptySummary();
          }
        }
      });
  }

  loadDetailedSummary(date: Date) {
    console.log('[DailySummary] Loading detailed summary data for date:', date);
    
    // Check for account ID - if missing, don't attempt to load detailed data
    const accountId = this.accountsService.getAccountId();
    if (!accountId) {
      return;
    }
    
    this.detailedLoading = true;
    this.detailedError = null;
    this.detailedData = null; // Reset detailed data
    this.selectedNutrient = null;
    this.selectedFood = null;

    this.dailySummaryService.getDetailedSummary(date, true) // Pass true to force reload from backend
      .pipe(
        catchError(error => {
          console.error('Error loading detailed summary:', error);
          this.detailedError = 'Unable to load detailed nutrition breakdown. Please try again later.';
          return of(null as GetDetailedSummaryResponse | null);
        }),
        finalize(() => {
          this.detailedLoading = false;
        })
      )
      .subscribe({
        next: (result: GetDetailedSummaryResponse | null) => {
          if (result && result.isSuccess) {
            this.detailedData = result;
          }
        }
      });
  }
  
  // Create an empty summary with zeroed values
  createEmptySummary() {
    this.isEmptySummary = true;
    const today = new Date();
    
    const emptyMacros = new MacronutrientsSummary({
      protein: 0,
      carbohydrates: 0,
      fat: 0,
      fiber: 0,
      sugar: 0,
      saturatedFat: 0
    });
    
    this.summaryData = new NutritionSummaryResponse({
      periodStart: today,
      periodEnd: today,
      totalCalories: 0,
      macronutrients: emptyMacros,
      micronutrients: {}
    });
  }
  
  // Helper method to get micronutrients as an array for display from summary data
  getSummaryMicronutrients(): { name: string; value: number }[] {
    if (!this.summaryData?.micronutrients) {
      return [];
    }
    
    return Object.entries(this.summaryData.micronutrients as Record<string, number>).map(([name, value]) => ({
      name,
      value
    }));
  }
  
  // Helper method to check if all values are zero
  hasZeroValues(): boolean {
    if (!this.summaryData) return true;
    
    return this.summaryData.totalCalories === 0 &&
           this.summaryData.macronutrients?.protein === 0 &&
           this.summaryData.macronutrients?.carbohydrates === 0 &&
           this.summaryData.macronutrients?.fat === 0;
  }

  // Helper to format amount with unit
  formatAmountWithUnit(amount: number, unit: string): string {
    return `${amount.toFixed(1)} ${unit}`;
  }

  // Helper to format food contributions using the original food unit if available
  formatAmountWithFoodUnit(food: FoodContribution): string {
    if (food.foodUnit) {
      return `${food.amount?.toFixed(1) || '0.0'} ${food.foodUnit}`;
    } else {
      return `${food.amount?.toFixed(1) || '0.0'} ${food.unit || ''}`;
    }
  }

  // Helper methods to separate a food's nutrients into macronutrient and micronutrient categories
  getFoodMacronutrients(nutrients: NutrientContribution[] | undefined | null): NutrientContribution[] {
    if (!nutrients) return [];
    return nutrients.filter(n => this.isMacronutrient(n.name || ''));
  }
  
  getFoodMicronutrients(nutrients: NutrientContribution[] | undefined | null): NutrientContribution[] {
    if (!nutrients) return [];
    return nutrients.filter(n => !this.isMacronutrient(n.name || ''));
  }

  // Safe helper method to access nutrients from a food
  getSafeNutrients(food: FoodBreakdown | null): NutrientContribution[] {
    return food?.nutrients || [];
  }

  // Helper to format nutrient contributions with original unit if available
  formatNutrientWithOriginalUnit(nutrient: NutrientContribution): string {
    if (nutrient.originalUnit) {
      return `${nutrient.amount?.toFixed(1) || '0.0'} ${nutrient.originalUnit}`;
    } else {
      return `${nutrient.amount?.toFixed(1) || '0.0'} ${nutrient.unit || ''}`;
    }
  }
} 
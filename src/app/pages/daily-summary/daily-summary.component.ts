import { Component, OnInit, OnDestroy, inject, ViewChild } from '@angular/core';
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
  IonButton,
  IonPopover
} from '@ionic/angular/standalone';
import { FormsModule } from '@angular/forms';
import { 
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
import { 
  chevronDownOutline, 
  chevronForwardOutline, 
  closeOutline, 
  ellipsisVerticalOutline,
  alertCircleOutline,
  nutritionOutline
} from 'ionicons/icons';
import { ChatService } from 'src/app/services/chat.service';
import { AppHeaderComponent } from 'src/app/components/header/header.component';
import { EntryActionMenuComponent, ActionEvent, ActionType } from '../../components/entry-action-menu';
import { formatNutrient } from '../../utils/format-nutrient';
import { formatMacro } from '../../utils/format-macro';

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
    IonIcon,
    IonButton,
    IonPopover,
    AppHeaderComponent,
    EntryActionMenuComponent
  ]
})
export class DailySummaryComponent implements OnInit, OnDestroy {
  @ViewChild('popover') popover: IonPopover;
  
  detailedData: GetDetailedSummaryResponse | null = null;
  viewMode: 'nutrients' | 'foods' = 'nutrients';
  selectedNutrient: NutrientBreakdown | null = null;
  selectedFood: FoodBreakdown | null = null;
  detailedLoading = false;
  detailedError: string | null = null;
  selectedDate: string = new Date().toISOString();
  userEmail: string | null = null;
  private dateSubscription: Subscription;
  private mealLoggedSubscription: Subscription;
  
  // Variables for popover
  isPopoverOpen = false;
  selectedEntry: any = null;
  popoverEvent: any = null;
  
  // List of recognized macronutrient names (case-insensitive)
  private readonly macronutrientNames: string[] = [
    'protein', 'proteins',
    'carbohydrate', 'carbohydrates', 'carbs', 'carb',
    'fat', 'fats',
    'fiber', 
    'sugar',
    'calories', 'calorie',
    'saturated fat', 'unsaturated fat', 'trans fat'
  ];
  
  // Use the inject function for dependency injection in standalone components
  private dailySummaryService = inject(DailySummaryService);
  private accountsService = inject(AccountsService);
  private authService = inject(AuthService);
  private dateService = inject(DateService);
  private chatService = inject(ChatService);
  private router = inject(Router);

  constructor() {
    addIcons({ 
      chevronDownOutline, 
      chevronForwardOutline, 
      closeOutline, 
      ellipsisVerticalOutline,
      alertCircleOutline,
      nutritionOutline
    });
  }

  ngOnInit() {
    // Subscribe to date changes
    this.dateSubscription = this.dateService.selectedDate$.subscribe(date => {
      this.selectedDate = date;
      this.loadDetailedSummary(new Date(date));
    });
    
    // Subscribe to meal logged events from ChatService
    this.mealLoggedSubscription = this.chatService.mealLogged$.subscribe(() => {
      console.log('[DailySummary] Meal logged event received, reloading summary data');
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
  
  // Open the action menu popover
  openActionMenu(event: Event, entry: any, entryType: 'nutrient' | 'food') {
    event.stopPropagation(); // Prevent the row selection when clicking the menu button
    this.popoverEvent = event;
    this.selectedEntry = { ...entry, entryType };
    this.isPopoverOpen = true;
  }
  
  // Handle the action selected from the popover
  handleActionSelected(event: ActionEvent) {
    console.log(`Action received: ${event.action} for entry:`, event.entry);
    
    // Close the popover
    this.isPopoverOpen = false;
    
    // Handle the action based on type
    switch(event.action) {
      case 'remove':
        this.handleRemoveEntry(event.entry);
        break;
      case 'edit':
        this.handleEditEntry(event.entry);
        break;
      case 'focusInChat':
        this.handleFocusInChat(event.entry);
        break;
      case 'editGoal':
        this.handleEditGoal(event.entry);
        break;
      case 'learn':
        this.handleLearnAbout(event.entry);
        break;
      case 'trend':
        this.handleShowTrend(event.entry);
        break;
      case 'pin':
        this.handlePinToDashboard(event.entry);
        break;
      case 'ignore':
        this.handleIgnoreForNow(event.entry);
        break;
      case 'suggest':
        this.handleSuggestFoods(event.entry);
        break;
    }
  }
  
  private handleRemoveEntry(entry: any) {
    console.log('Would remove entry:', entry);
    // Actual implementation would be added here
  }
  
  private handleEditEntry(entry: any) {
    console.log('Would edit entry:', entry);
    // Actual implementation would be added here
  }
  
  private handleFocusInChat(entry: any) {
    console.log('Would focus on entry in chat:', entry);
    
    // Navigate to chat page with the entry details
    // This is a stub - actual implementation would depend on how you want to handle this
    const entryName = entry.name || 'this food';
    this.router.navigate(['/chat'], { 
      queryParams: { 
        focus: entryName 
      }
    });
  }
  
  private handleEditGoal(entry: any) {
    console.log('Would create or modify goal for:', entry);
    // Actual implementation would be added here
  }
  
  private handleLearnAbout(entry: any) {
    console.log('Would show learning information about:', entry);
    // Actual implementation would be added here
  }
  
  private handleShowTrend(entry: any) {
    console.log('Would show trend for:', entry);
    // Actual implementation would be added here
  }
  
  private handlePinToDashboard(entry: any) {
    console.log('Would pin to dashboard:', entry);
    // Actual implementation would be added here
  }
  
  private handleIgnoreForNow(entry: any) {
    console.log('Would ignore for now:', entry);
    // Actual implementation would be added here
  }
  
  private handleSuggestFoods(entry: any) {
    console.log('Would suggest foods related to:', entry);
    // Actual implementation would be added here
  }
  
  // Handle date changes from the header
  onDateChanged(newDate: string) {
    this.dateService.setSelectedDate(newDate);
  }
  
  // Handle navigation to previous day
  onPreviousDay() {
    this.dateService.goToPreviousDay();
  }
  
  // Handle navigation to next day
  onNextDay() {
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
    
    // Check if it's an exact match for a macronutrient 
    return this.macronutrientNames.some(macro => 
      lowerName === macro || 
      // Or check if it starts with the macro name and is followed by a non-word character or end of string
      (lowerName.startsWith(macro) && (lowerName.length === macro.length || !lowerName[macro.length].match(/[a-z0-9]/)))
    );
  }

  loadDetailedSummary(date: Date) {
    this.detailedLoading = true;
    this.detailedError = null;
    this.detailedData = null;
    this.selectedNutrient = null;
    this.selectedFood = null;
    
    this.dailySummaryService.getDetailedSummary(date)
      .pipe(
        finalize(() => {
          this.detailedLoading = false;
        }),
        catchError(error => {
          console.error('Error loading detailed summary:', error);
          this.detailedError = 'Failed to load detailed nutrition data. Please try again.';
          return of(null);
        })
      )
      .subscribe(response => {
        if (response) {
          // Check if the response has no entries but has a specific error message
          if (!response.isSuccess && 
              response.errors && 
              response.errors.length > 0 && 
              response.errors[0].errorMessage === "No food entries found for the specified date.") {
            // Treat this as an empty state, not an error
            console.log('[DailySummaryComponent] No entries found for the date');
            
            // Just set the properties we need rather than trying to create a new object
            response.isSuccess = true; // Override to prevent error display
            response.errors = []; // Clear errors
            this.detailedData = response;
          } else {
            this.detailedData = response;
            console.log('[DailySummaryComponent] Detailed summary loaded:', response);
          }
        }
      });
  }
  
  // Helper method to get micronutrients as an array for display from summary data
  getSummaryMicronutrients(): { name: string; value: number }[] {
    if (!this.detailedData?.nutrients) {
      return [];
    }
    
    return this.detailedData.nutrients
      .filter(nutrient => nutrient.name && nutrient.totalAmount !== undefined)
      .map(nutrient => ({
        name: nutrient.name!,
        value: nutrient.totalAmount!
      }));
  }
  
  // Helper to format amount with unit
  formatAmountWithUnit(amount: number, unit: string, nutrientName?: string): string {
    const name = nutrientName || unit;
    if (this.isMacronutrient(name)) {
      return formatMacro(name, amount);
    }
    return formatNutrient(amount);
  }

  // Helper to format food contributions using the original food unit if available
  formatAmountWithFoodUnit(food: FoodContribution): string {
    if (this.isMacronutrient(food.name || '')) {
      return formatMacro(food.name || '', food.amount);
    }
    return formatNutrient(food.amount);
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
    if (nutrient?.name && this.isMacronutrient(nutrient.name)) {
      return formatMacro(nutrient.name, nutrient.amount);
    }
    return formatNutrient(nutrient.amount);
  }
} 
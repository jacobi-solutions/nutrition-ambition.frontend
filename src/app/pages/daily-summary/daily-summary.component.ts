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
  IonPopover,
  IonRefresher,
  IonRefresherContent
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
  ellipsisVertical,
  alertCircleOutline,
  nutritionOutline
} from 'ionicons/icons';
import { ChatService } from 'src/app/services/chat.service';
import { AppHeaderComponent } from 'src/app/components/header/header.component';
import { ActionEvent, EntryActionMenuComponent } from '../../components/entry-action-menu/entry-action-menu.component';
import { formatNutrient } from '../../utils/format-nutrient';
import { formatMacro } from '../../utils/format-macro';
import { ToastController } from '@ionic/angular';
import { FoodLogService } from 'src/app/services/food-log.service';

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
    IonRefresher,
    IonRefresherContent,
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
  /* private readonly macronutrientNames: string[] = [
    'protein', 'proteins',
    'carbohydrate', 'carbohydrates', 'carbs', 'carb',
    'fat', 'fats',
    'fiber', 
    'sugar',
    'calories', 'calorie',
    'saturated fat', 'unsaturated fat', 'trans fat'
  ]; */
  
  // Use the inject function for dependency injection in standalone components
  private dailySummaryService = inject(DailySummaryService);
  private accountsService = inject(AccountsService);
  private authService = inject(AuthService);
  private dateService = inject(DateService);
  private chatService = inject(ChatService);
  private router = inject(Router);
  private toastController = inject(ToastController);
  private foodLogService = inject(FoodLogService);

  constructor() {
    addIcons({ 
      chevronDownOutline, 
      chevronForwardOutline, 
      closeOutline, 
      ellipsisVertical,
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
      case 'ignore':
        this.handleIgnoreForNow(event.entry);
        break;
      case 'suggest':
        this.handleSuggestFoods(event.entry);
        break;
    }
  }
  
  private handleRemoveEntry(entry: any) {
    // Only handle removal for food entries
    if (entry.entryType !== 'food') {
      console.warn('Cannot remove entry that is not a food item:', entry);
      return;
    }
    
    console.log('Removing food entry:', entry);
    
    // Store a reference to the original foods list for undo
    const originalFoods = this.detailedData?.foods ? [...this.detailedData.foods] : [];
    
    // Get the array of food item IDs from the entry
    const foodItemIds = entry.foodItemIds;
    
    if (!foodItemIds || foodItemIds.length === 0) {
      console.error('Cannot remove food entry without IDs:', entry);
      return;
    }
    
    // Immediately update the UI by filtering out the removed item
    if (this.detailedData?.foods) {
      // Remove based on name rather than ID since FoodBreakdown doesn't have ID
      const foodName = entry.name;
      this.detailedData.foods = this.detailedData.foods.filter(food => food.name !== foodName);
      
      // Also clear selection if the removed item was selected
      if (this.selectedFood?.name === foodName) {
        this.selectedFood = null;
      }
    }
    
    // Show a toast with an undo option
    this.toastController.create({
      message: `Removed "${entry.name}"`,
      duration: 5000,
      position: 'bottom',
      buttons: [
        {
          text: 'UNDO',
          role: 'cancel',
          handler: () => {
            // Restore the original foods list if user undoes the action
            if (this.detailedData) {
              this.detailedData.foods = originalFoods;
            }
          }
        }
      ]
    }).then(toast => {
      toast.present();
      
      // When the toast is dismissed (times out without undo), persist the deletion
      toast.onDidDismiss().then((dismissData) => {
        // Only persist if the user didn't click undo (role !== 'cancel')
        if (dismissData.role !== 'cancel') {
          // Use FoodLogService to delete the items
          this.foodLogService.deleteFoodEntryItems(foodItemIds).subscribe({
            next: () => console.log('Food items deletion confirmed'),
            error: (err) => {
              console.error('Error deleting food items:', err);
              // Restore the data on error
              if (this.detailedData) {
                this.detailedData.foods = originalFoods;
              }
            }
          });
        }
      });
    });
  }
  
  private handleEditEntry(entry: any) {
    console.log('Would edit entry:', entry);
    // Actual implementation would be added here
  }
  
  private handleFocusInChat(entry: FoodBreakdown | NutrientBreakdown) {
    console.log('Focusing on entry in chat:', entry.name);
    
    // Get the current date from the dateService
    const loggedDate = new Date(this.selectedDate);
    
    // Set the context note
    this.chatService.setContextNote('Focusing on: ' + (entry.name || 'this item'));
    
    // Close the popover explicitly
    this.isPopoverOpen = false;
    
    // Explicitly dismiss the popover to ensure it's closed before navigation
    if (this.popover) {
      this.popover.dismiss();
    }
    
    // Navigate to the chat page immediately so users can see the context note
    this.router.navigate(['/app/chat']);
    
    // Use the chatService to focus in chat
    this.chatService.focusInChat(entry.name || 'this item', loggedDate).subscribe({
      next: (response) => {
        if (response.isSuccess) {
          // Success! The context note will be cleared by the ChatPage when it receives the message
          // Nothing else to do here
        } else {
          // Show error toast only if the operation fails
          this.presentToast('Unable to focus on this topic. Please try again.');
          // Clear the context note if the operation fails
          this.chatService.clearContextNote();
        }
      },
      error: (error) => {
        console.error('Error focusing in chat:', error);
        this.presentToast('Unable to focus on this topic. Please try again.');
        // Clear the context note if there's an error
        this.chatService.clearContextNote();
      }
    });
  }
  
  // Helper to show toast messages
  private async presentToast(message: string) {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      position: 'bottom',
      color: 'danger'
    });
    await toast.present();
  }
  
  private handleEditGoal(entry: any) {
    console.log('Would create or modify goal for:', entry);
    // Actual implementation would be added here
  }
  
  private handleLearnAbout(entry: FoodBreakdown | NutrientBreakdown) {
    const topic = entry.name || '';
    console.log('Learning more about:', topic);
    
    // Get the current date from the dateService
    const loggedDate = new Date(this.selectedDate);
    
    // Close the popover explicitly
    this.isPopoverOpen = false;
    
    // Explicitly dismiss the popover to ensure it's closed before navigation
    if (this.popover) {
      this.popover.dismiss();
    }
    
    // Navigate to the chat page immediately so users can see the context note
    this.router.navigate(['/app/chat']);
    
    // Use the chatService to learn more about the topic
    this.chatService.learnMoreAbout(topic, loggedDate)
      .subscribe({
        next: (response) => {
          if (!response.isSuccess) {
            // Show error toast only if the operation fails
            this.presentToast('Unable to learn more about this topic. Please try again.');
          }
          // Note: Context note will be automatically cleared by the finalize operator in the service
        },
        error: (error) => {
          console.error('Error learning more about topic:', error);
          this.presentToast('Unable to learn more about this topic. Please try again.');
        }
      });
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
      this.router.navigate(['/auth']);
    });
  }

  // Handle refresh from header pull-down
  onRefresh() {
    console.log('[DailySummary] Refresh triggered, reloading data');
    this.loadDetailedSummary(new Date(this.selectedDate));
  }
  
  // Handle refresh from ion-refresher
  handleRefresh(event: CustomEvent) {
    console.log('[DailySummary] Pull-to-refresh triggered, reloading data');
    this.loadDetailedSummary(new Date(this.selectedDate));
    
    // Complete the refresh after a short delay
    setTimeout(() => {
      (event.target as any)?.complete();
    }, 1000);
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
    if (!this.detailedData?.nutrients) return [];

    const targetOrder = ['Calories', 'Protein', 'Fat', 'Carbohydrates' ];

    return targetOrder
      .map(name => this.detailedData?.nutrients?.find(n => n.name?.toLowerCase() === name.toLowerCase()))
      .filter((n): n is NutrientBreakdown => !!n);
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
    const macronutrients = ['calories', 'protein', 'fat','carbohydrates'];
    
    return macronutrients.some(macro => lowerName === macro || lowerName.startsWith(macro));
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
            
            // Diagnostic logging for protein values
            
           
          
            
            // Log all foods and their nutrients
            if (response.foods) {
              
              response.foods.forEach(food => {
                
                if (food.nutrients) {
                  const proteinEntry = food.nutrients.find(n => n.name === 'Protein');
                  
                }
              });
            }
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
      const formatted = formatMacro(name, amount);
      
      
      return formatted;
    }
    // Use the unit parameter that comes from the API
    return `${Math.round(amount * 10) / 10} ${unit || 'mg'}`;
  }

  // Helper to format food contributions using the original food unit if available
  formatAmountWithFoodUnit(food: FoodContribution): string {
    if (this.isMacronutrient(food.name || '')) {
      return formatMacro(food.name || '', food.amount || 0);
    }
    // Use the unit parameter that comes from the API
    return `${Math.round((food.amount || 0) * 10) / 10} ${food.unit || 'mg'}`;
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
    // Use the unit parameter that comes from the API
    return `${Math.round((nutrient.amount || 0) * 10) / 10} ${nutrient.unit || 'mg'}`;
  }
  
  /**
   * Track function for ngFor directives to optimize rendering performance
   * @param index The index of the current item
   * @param item The item object with an id property
   * @returns The item's id or a fallback value
   */
  trackById(index: number, item: any): string {
    // Return the unique ID if it exists
    if (item && item.id) {
      return item.id;
    }
    
    // Fallback to name for FoodBreakdown items which don't have an id
    if (item && item.name) {
      // Add index to prevent duplicate key issues with items of the same name
      return `${item.name}-${index}`;
    }
    
    // Last resort fallback to index
    return index.toString();
  }
} 
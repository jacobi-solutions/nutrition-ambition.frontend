import { Component, OnInit, OnDestroy, inject, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonContent, IonCard, IonCardHeader, IonCardTitle, IonCardContent,
  IonSpinner, IonSegment, IonSegmentButton, IonLabel, IonList,
  IonItem, IonIcon, IonButton, IonPopover, IonRefresher, IonRefresherContent,
  IonRow, IonCol
} from '@ionic/angular/standalone';
import { FormsModule } from '@angular/forms';
import {
  GetDetailedSummaryResponse,
  NutrientBreakdown,
  FoodBreakdown,
  FoodContribution,
  ComponentBreakdown,
  NutritionAmbitionApiService,
  EditFoodSelectionRequest,
  SubmitEditServingSelectionRequest
} from '../../services/nutrition-ambition-api.service';
import {
  FoodBreakdownDisplay,
  ComponentBreakdownDisplay,
  FoodEntryBreakdownDisplay,
  NutrientBreakdownDisplay
} from '../../models/daily-summary-display';
import { catchError, finalize, of, Subscription, skip } from 'rxjs';
import { DailySummaryService } from 'src/app/services/daily-summary.service';
import { AuthService } from 'src/app/services/auth.service';
import { DateService } from 'src/app/services/date.service';
import { ChatService } from 'src/app/services/chat.service';
import { FoodEntryService } from 'src/app/services/food-entry.service';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import {
  chevronDownOutline,
  chevronForwardOutline,
  closeOutline,
  ellipsisVertical,
  alertCircleOutline,
  nutritionOutline,
  informationCircleOutline,
  informationCircle,
  list,
  barChart
} from 'ionicons/icons';
import { AppHeaderComponent } from 'src/app/components/header/header.component';
import { EntryActionMenuComponent, ActionEvent } from 'src/app/components/entry-action-menu/entry-action-menu.component';
import { FoodSelectionComponent } from 'src/app/components/food-selection/food-selection.component';
import { MacronutrientsChartComponent } from 'src/app/components/macronutrients-chart/macronutrients-chart.component';
import { ToastService } from 'src/app/services/toast.service';
import { ViewWillEnter } from '@ionic/angular';
import { format } from 'date-fns';
import { FoodSelectionService } from 'src/app/services/food-selection.service';
import { AnalyticsService } from 'src/app/services/analytics.service';
import { BaseChartDirective } from 'ng2-charts';
import { Chart, ChartConfiguration, BarElement, BarController, CategoryScale, LinearScale, ArcElement, Tooltip, Legend, DoughnutController } from 'chart.js';
import { NutritionChartService } from 'src/app/services/nutrition-chart.service';

// Register Chart.js components
Chart.register(BarElement, BarController, CategoryScale, LinearScale, ArcElement, Tooltip, Legend, DoughnutController);

@Component({
  selector: 'app-daily-summary',
  templateUrl: './daily-summary.page.html',
  styleUrls: ['./daily-summary.page.scss'],
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
    EntryActionMenuComponent,
    FoodSelectionComponent,
    MacronutrientsChartComponent
  ]
})
export class DailySummaryPage implements OnInit, OnDestroy, ViewWillEnter {
  @ViewChild('popover') popover: IonPopover;
  @ViewChild(IonContent) content: IonContent;

  detailedData: GetDetailedSummaryResponse | null = null;
  viewMode: 'nutrients' | 'foods' = 'nutrients';

  // Display models with precomputed values
  nutrientsDisplay: NutrientBreakdownDisplay[] = [];
  foodEntriesDisplay: FoodEntryBreakdownDisplay[] = [];

  // Selected items (using display models)
  selectedNutrient: NutrientBreakdownDisplay | null = null;
  selectedFood: FoodBreakdownDisplay | null = null;
  selectedComponent: ComponentBreakdownDisplay | null = null;
  foodShowingNutrients: FoodBreakdownDisplay | null = null;  // Track which food is showing nutrients via info icon
  detailedLoading = false;
  detailedError: string | null = null;
  // Local date only — uses 'yyyy-MM-dd' format
  // UTC conversion handled via dateService when communicating with backend
  selectedDate: string = format(new Date(), 'yyyy-MM-dd');
  userEmail: string | null = null;

  private dateSubscription: Subscription;
  private mealLoggedSubscription: Subscription;

  isPopoverOpen = false;
  selectedEntry: any = null;
  popoverEvent: any = null;
  
  // Track temporarily removed foods for undo functionality
  private removedFoods: Map<string, any> = new Map();
  private undoTimeouts: Map<string, any> = new Map();

  // In-place editing state
  editingFoodKey: string | null = null;
  editingMessage: any | null = null;
  isLoadingEdit = false;

  // Chart state
  showMacroCharts = false;
  caloriesChartData: ChartConfiguration<'bar'>['data'] = { labels: [], datasets: [] };
  caloriesChartOptions: ChartConfiguration<'bar'>['options'] = {};
  macroChartData: ChartConfiguration<'doughnut'>['data'] = { labels: [], datasets: [] };
  macroChartOptions: ChartConfiguration<'doughnut'>['options'] = {};

  private dailySummaryService = inject(DailySummaryService);
  private authService = inject(AuthService);
  private dateService = inject(DateService);
  private chatService = inject(ChatService);
  private foodEntryService = inject(FoodEntryService);
  private router = inject(Router);
  private toastService = inject(ToastService);
  private chartService = inject(NutritionChartService);

  constructor(
    private elementRef: ElementRef,
    private foodSelectionService: FoodSelectionService,
    private analytics: AnalyticsService // Firebase Analytics tracking
  ) {
    addIcons({
      chevronDownOutline,
      chevronForwardOutline,
      closeOutline,
      ellipsisVertical,
      alertCircleOutline,
      nutritionOutline,
      informationCircleOutline,
      informationCircle,
      list,
      barChart
    });
    this.initializeChartOptions();
  }

  ngOnInit() {
    // Firebase Analytics: Track page view on initialization
    this.analytics.trackPageView('DailySummary');
    
    // React to date changes after initial value to prevent duplicate load with ionViewWillEnter
    this.dateSubscription = this.dateService.selectedDate$
      .pipe(skip(1))
      .subscribe(date => {
        this.selectedDate = date;
        this.loadDetailedSummary(this.dateService.getSelectedDate());
        
        // Firebase Analytics: Track page view when date changes
        this.analytics.trackPageView('DailySummary');
      });

    this.authService.userEmail$.subscribe(email => {
      this.userEmail = email;
    });

    // Listen for meal logging events from chat service to refresh data
    this.mealLoggedSubscription = this.chatService.mealLogged$.subscribe(() => {
      this.loadDetailedSummary(this.dateService.getSelectedDate(), true);
    });
  }

  ngOnDestroy() {
    this.dateSubscription?.unsubscribe();
    this.mealLoggedSubscription?.unsubscribe();
    
    // Clean up any pending removal timeouts
    this.undoTimeouts.forEach((timeoutId) => {
      clearTimeout(timeoutId);
    });
    this.undoTimeouts.clear();
    this.removedFoods.clear();
  }

  ionViewWillEnter() {
    // Force reload when entering the tab since user might have added food from chat
    this.selectedDate = this.dateService.getSelectedDate();
    this.loadDetailedSummary(this.dateService.getSelectedDate(), true);
  }

  onDateChanged(newDate: string) {
    this.dateService.setSelectedDate(newDate);
  }

  onPreviousDay() {
    this.dateService.goToPreviousDay();
  }

  onNextDay() {
    this.dateService.goToNextDay();
  }

  onLogin() {
    this.router.navigate(['/login']);
  }

  onLogout() {
    this.authService.signOutUser().then(() => {
      this.router.navigate(['/login']);
    });
  }

  onRefresh(event?: CustomEvent) {
    this.loadDetailedSummary(this.dateService.getSelectedDate(), true);
    
    // Complete the refresher if event is provided
    if (event && event.target) {
      setTimeout(() => {
        (event.target as any)?.complete();
      }, 1000);
    }
  }

  loadDetailedSummary(localDateKey: string, forceReload: boolean = false) {
    this.detailedLoading = true;
    this.detailedError = null;
    this.detailedData = null;
    this.selectedNutrient = null;
    this.selectedFood = null;

    this.dailySummaryService.getDetailedSummary(localDateKey, forceReload)
      .pipe(
        finalize(() => this.detailedLoading = false),
        catchError(err => {
          this.detailedError = 'Failed to load nutrition data.';
          return of(null);
        })
      )
      .subscribe(response => {
        if (response) {
          this.detailedData = response;
          this.convertToDisplayModels();
        }
      });
  }

  // Sort macronutrients in desired fixed order
  get macronutrientList(): NutrientBreakdownDisplay[] {
    const order = ['calories', 'protein', 'fat', 'carbohydrate'];
    return order
      .map(key => this.nutrientsDisplay.find(n => n.nutrientKey?.toLowerCase() === key.toLowerCase()))
      .filter((n): n is NutrientBreakdownDisplay => !!n);
  }

  // Sort micronutrients using sortOrder field (set by backend)
  get micronutrientList(): NutrientBreakdownDisplay[] {
    return this.nutrientsDisplay
      .filter(n => !['calories', 'protein', 'fat', 'carbohydrate'].includes(n.nutrientKey?.toLowerCase() || ''))
      .sort((a, b) => {
        return ((a as any)['sortOrder'] ?? 9999) - ((b as any)['sortOrder'] ?? 9999);
      });
  }

  // Get macronutrients for the selected food
  get selectedFoodMacronutrients(): any[] {
    if (!this.selectedFood?.nutrients) return [];
    const order = ['calories', 'protein', 'fat', 'carbohydrate'];
    return order
      .map(key => this.selectedFood?.nutrients?.find(n => n.nutrientKey?.toLowerCase() === key.toLowerCase()))
      .filter((n): n is any => !!n);
  }

  // Get micronutrients for the selected food
  get selectedFoodMicronutrients(): any[] {
    if (!this.selectedFood?.nutrients) return [];
    return this.selectedFood.nutrients
      .filter(n => !['calories', 'protein', 'fat', 'carbohydrate'].includes(n.nutrientKey?.toLowerCase() || ''))
      .sort((a, b) => {
        return ((a as any)['sortOrder'] ?? 9999) - ((b as any)['sortOrder'] ?? 9999);
      });
  }

  // Get macronutrients for food showing nutrients
  get foodShowingNutrientsMacros(): any[] {
    if (!this.foodShowingNutrients?.nutrients) return [];
    const order = ['calories', 'protein', 'fat', 'carbohydrate'];
    return order
      .map(key => this.foodShowingNutrients?.nutrients?.find(n => n.nutrientKey?.toLowerCase() === key.toLowerCase()))
      .filter((n): n is any => !!n);
  }

  // Get micronutrients for food showing nutrients
  get foodShowingNutrientsMicros(): any[] {
    if (!this.foodShowingNutrients?.nutrients) return [];
    return this.foodShowingNutrients.nutrients
      .filter(n => !['calories', 'protein', 'fat', 'carbohydrate'].includes(n.nutrientKey?.toLowerCase() || ''))
      .sort((a, b) => {
        return ((a as any)['sortOrder'] ?? 9999) - ((b as any)['sortOrder'] ?? 9999);
      });
  }

  formatConsumedTarget(nutrient: NutrientBreakdown): string {
    const amount = nutrient.totalAmount || 0;
    const unit = nutrient.unit || 'mg';
    const formattedAmount = `${amount.toFixed(unit === 'kcal' ? 0 : 1)} ${unit}`;
    const min = nutrient.minTarget;
    const max = nutrient.maxTarget;

    const formatValue = (v: number) => v >= 10 ? v.toFixed(0) : v.toFixed(1).replace(/\.0$/, '');

    if (min != null && max != null) {
      if (min === max) return `${formattedAmount} / ≤ ${formatValue(max)} ${unit}`;
      return `${formattedAmount} / (${formatValue(min)} - ${formatValue(max)} ${unit})`;
    } else if (max != null) {
      return `${formattedAmount} / ≤ ${formatValue(max)} ${unit}`;
    } else if (min != null) {
      return `${formattedAmount} / ≥ ${formatValue(min)} ${unit}`;
    }

    return formattedAmount;
  }

  formatAmountWithFoodUnit(food: FoodContribution): string {
    const amount = food.amount || 0;
    const unit = food.unit || 'mg';
    return `${Math.round(amount * 10) / 10} ${unit}`;
  }

  formatQuantity(value: number | undefined): string {
    if (!value || !isFinite(value) || isNaN(value)) return '0';
    // Round to 2 decimal places and remove trailing zeros
    const rounded = Math.round(value * 100) / 100;
    return rounded.toString();
  }

  // Check if a food has only one component
  isSingleComponentFood(food: FoodBreakdown): boolean {
    return food.componentCount === 1 || (food.components?.length === 1);
  }

  // Check if a food has multiple components
  isMultiComponentFood(food: FoodBreakdown): boolean {
    return (food.componentCount || 0) > 1 || (food.components?.length || 0) > 1;
  }

  // Get the display name for a food (with ingredient count for multi-component foods)
  getFoodDisplayName(food: FoodBreakdown): string {
    const baseName = food.name || 'Unknown Food';
    
    // For multi-component foods, append ingredient count
    if (this.isMultiComponentFood(food)) {
      const componentCount = food.componentCount || food.components?.length || 0;
      return `${baseName} - ${componentCount} components`;
    }
    
    // For single-component foods, just return the name
    return baseName;
  }

  // Get the display text for a food's serving information
  getFoodServingDisplay(food: FoodBreakdown): string {
    // For single-component foods, show the component's serving info
    if (this.isSingleComponentFood(food) && food.components?.[0]) {
      const component = food.components[0];
      const quantity = this.formatQuantity(component.totalAmount);
      const unit = component.unit || 'serving';
      return `${quantity} ${unit}`;
    }

    // For multi-component foods, show the food-level quantity and unit
    const quantity = this.formatQuantity(food.quantity || 1);
    const unit = food.foodUnit || 'serving';
    return `${quantity} ${unit}`;
  }

  selectNutrient(nutrient: NutrientBreakdownDisplay) {
    const isAlreadySelected = this.selectedNutrient?.nutrientKey === nutrient.nutrientKey;
    this.selectedNutrient = isAlreadySelected ? null : nutrient;
    this.selectedFood = null;
    this.selectedComponent = null;

    // Update all selection states
    this.updateAllSelectionStates();

    // No auto-scroll when opening drilldown in the same tab
  }

  selectFood(food: FoodBreakdownDisplay) {
    const isAlreadySelected = this.selectedFood?.foodId === food.foodId;
    this.selectedFood = isAlreadySelected ? null : food;
    this.selectedNutrient = null;
    this.selectedComponent = null; // Reset component selection when selecting a food

    // Update all selection states
    this.updateAllSelectionStates();

    // No auto-scroll when opening drilldown in the same tab
  }

  showFoodNutrients(event: Event, food: FoodBreakdownDisplay) {
    event.stopPropagation();
    // Toggle the nutrient display state
    if (this.foodShowingNutrients?.foodId === food.foodId) {
      this.foodShowingNutrients = null;
    } else {
      this.foodShowingNutrients = food;
    }
  }

  selectComponent(component: ComponentBreakdownDisplay) {
    const isAlreadySelected = this.selectedComponent?.componentId === component.componentId;
    this.selectedComponent = isAlreadySelected ? null : component;
    // Keep the food selected when selecting a component

    // Update all selection states
    this.updateAllSelectionStates();
  }

  isSameComponent(component1: ComponentBreakdown | null, component2: ComponentBreakdown | null): boolean {
    if (!component1 || !component2) return false;
    return component1.componentId === component2.componentId;
  }

  

  navigateToFood(foodName: string) {
    this.viewMode = 'foods';
    // Find the food in the display models
    for (const entry of this.foodEntriesDisplay) {
      const food = entry.foodsDisplay?.find(f => f.name?.toLowerCase() === foodName.toLowerCase());
      if (food) {
        this.selectedFood = food;
        break;
      }
    }
    if (!this.selectedFood) {
      this.selectedFood = null;
    }
    this.selectedNutrient = null;
    
    // Scroll to the selected food after DOM updates
    setTimeout(() => {
      this.scrollToSelectedItem('food', foodName);
    }, 300);
  }

  navigateToNutrient(nutrientKey: string) {
    this.viewMode = 'nutrients';
    this.selectedNutrient = this.nutrientsDisplay.find(n => n.nutrientKey === nutrientKey) || null;
    this.selectedFood = null;
    
    // Scroll to the selected nutrient after DOM updates
    setTimeout(() => {
      this.scrollToSelectedItem('nutrient', nutrientKey);
    }, 300);
  }

  private scrollToSelectedItem(type: 'food' | 'nutrient', identifier: string) {
    if (!this.content) return;

    try {
      // Give Angular more time to update the DOM, especially for view mode changes
      setTimeout(() => {
        let targetElement: Element | null = null;
        
        if (type === 'food') {
          // For foods, look for the selected food item and its expanded drilldown
          targetElement = this.elementRef.nativeElement.querySelector('ion-item.selected');
          
          // If we can't find a selected item, try to find the expanded card
          if (!targetElement) {
            targetElement = this.elementRef.nativeElement.querySelector('ion-card.expanded');
          }
        } else if (type === 'nutrient') {
          // For nutrients, look for the selected nutrient item
          targetElement = this.elementRef.nativeElement.querySelector('ion-item.selected');
          
          // If we can't find a selected item, try to find the expanded card
          if (!targetElement) {
            targetElement = this.elementRef.nativeElement.querySelector('ion-card.expanded');
          }
        }
        
        if (targetElement) {
          // Get the element's position relative to the document
          const targetRect = targetElement.getBoundingClientRect();
          
          // Get the content element's scroll position
          this.content.getScrollElement().then((scrollElement: HTMLElement) => {
            const contentRect = scrollElement.getBoundingClientRect();
            
            // Calculate the target scroll position
            // We want to position the element a bit below the top of the visible area
            const targetPosition = scrollElement.scrollTop + targetRect.top - contentRect.top - 80;
            
            // Ensure we don't scroll past the top
            const scrollPosition = Math.max(0, targetPosition);
            
            // Scroll smoothly to the target position
            this.content.scrollToPoint(0, scrollPosition, 500);
          });
        }
      }, 100); // Additional small delay to ensure DOM is fully updated
    } catch (error) {
      // Failed to scroll to selected item
    }
  }

  openActionMenu(event: Event, entry: any, type: 'food' | 'nutrient', component?: any) {
    event.stopPropagation();
    this.popoverEvent = event;
    this.selectedEntry = { ...entry, entryType: type, component: component };
    this.isPopoverOpen = true;
  }

  handleActionSelected(event: ActionEvent) {
    this.isPopoverOpen = false;
    if (this.popover) {
      this.popover.dismiss();
    }
    
    // Track analytics for action usage in daily summary context
    this.analytics.trackActionClick(event.action, 'daily_summary', { 
      entryType: event.entry?.entryType || 'unknown',
      entryId: event.entry?.id || event.entry?.entryId || 'unknown'
    });
    
    switch (event.action) {
      case 'remove':
        this.handleRemoveEntry(event.entry);
        break;
      case 'learn':
        this.handleLearnMore(event.entry);
        break;
      case 'edit':
        this.handleEditEntry(event.entry);   
      break;
      default:
        // Track unimplemented actions specifically
        this.analytics.trackUnimplementedFeature('entry_action', event.action, 'daily_summary');
    }
  }

  private handleEditEntry(entry: any) {
    if (entry.entryType !== 'food') {
      this.showErrorToast('Only food items can be edited.');
      return;
    }

    // Check if we're editing a component - if so, use the parent food's foodEntryId
    const isComponentEdit = entry.component && entry.component.componentId;
    const editTarget = isComponentEdit ? entry : entry; // entry is already the parent food for components

    if (!editTarget.foodEntryId) {
      this.showErrorToast('Sorry, could not locate this food to edit.');
      return;
    }

    // Find the entry name from the food entries
    const entryName = this.detailedData?.dailySummary?.foodEntries?.find(e =>
      e.foods?.some((f: any) => this.isSameFood(f, editTarget))
    )?.entryName || 'Food';

    // Set up in-place editing state (use the key of the food we're editing)
    this.editingFoodKey = this.getFoodKey(editTarget);
    this.isLoadingEdit = true;
    this.editingMessage = null;

    // Always load the entire food entry for editing to prevent data loss
    // Users can edit any component/food and all changes will be saved together
    const req = new EditFoodSelectionRequest({
      foodEntryId: editTarget.foodEntryId,
      foodId: '', // Empty to load entire entry
      componentId: '', // Empty to load entire entry
      localDateKey: this.dateService.getSelectedDate(),
      isInlineEdit: true
    });

    this.foodSelectionService.startEditFoodSelection(req).subscribe({
      next: (resp) => {
        this.isLoadingEdit = false;
        if (!resp?.isSuccess) {
          this.showErrorToast('Failed to start edit. Please try again.');
          this.clearEditingState();
        } else {
          // Extract the food selection message from the response
          const foodSelectionMessage = resp.messages?.find(m =>
            m.role === 'PendingEditFoodSelection' ||
            m.role === 'PendingFoodSelection'
          );

          if (foodSelectionMessage) {
            // Map mealSelections array to single mealSelection for UI components
            this.editingMessage = {
              ...foodSelectionMessage,
              mealSelection: foodSelectionMessage.mealSelections?.[0] || null,
              mealName: entryName
            };

            // Update selection states to show the editing UI
            this.updateAllSelectionStates();
          } else {
            this.showErrorToast('Invalid edit data received.');
            this.clearEditingState();
          }
        }
      },
      error: (err) => {
        this.isLoadingEdit = false;
        this.showErrorToast('An error occurred while starting the edit.');
        this.clearEditingState();
      }
    });
  }

  private clearEditingState() {
    this.editingFoodKey = null;
    this.editingMessage = null;
    this.isLoadingEdit = false;

    // Update selection states to hide the editing UI
    this.updateAllSelectionStates();
  }

  // Handle edit confirmation from food-selection component
  onEditConfirmed(request: any) {
    if (!request) {
      this.showErrorToast('Invalid edit data.');
      return;
    }

    this.foodSelectionService.submitEditServingSelection(request).subscribe({
      next: (response) => {
        if (response.isSuccess) {
          this.clearEditingState();
          // Refresh the data to show updated food
          this.loadDetailedSummary(this.dateService.getSelectedDate(), true);
          this.toastService.showToast({
            message: 'Food updated successfully',
            duration: 2000,
            color: 'success'
          });
        } else {
          this.showErrorToast('Failed to update food. Please try again.');
        }
      },
      error: (err) => {
        this.showErrorToast('An error occurred while updating food.');
      }
    });
  }

  // Handle edit cancellation from food-selection component
  onEditCanceled() {
    this.clearEditingState();
  }
  
  
  
  private async handleRemoveEntry(entry: any) {
    this.isPopoverOpen = false;
    // Only allow removal of food entries, not nutrients
    if (entry.entryType !== 'food') {
      await this.toastService.showToast({
        message: 'Only food items can be removed.',
        duration: 1500,
        color: 'medium'
      });
      return;
    }

    if (!entry.foodItemIds || entry.foodItemIds.length === 0) {
      return;
    }

    const foodName = this.getFoodDisplayName(entry);
    const foodKey = entry.foodItemIds.join(','); // Use joined IDs as unique key

    // Store the original entry for potential restoration
    this.removedFoods.set(foodKey, { ...entry });

    // Optimistically remove from UI
    this.removeFromUI(entry);

    // Show toast with undo option
    await this.toastService.showToast({
      message: `Removing "${foodName}"`,
      duration: 2000,
      color: 'medium',
      buttons: [
        {
          text: 'Undo',
          role: 'cancel',
          handler: () => {
            this.undoRemoval(foodKey);
          }
        }
      ]
    });

    // Set timeout to actually delete after toast duration
    const timeoutId = setTimeout(() => {
      this.confirmRemoval(foodKey);
    }, 4000);

    this.undoTimeouts.set(foodKey, timeoutId);
  }

  private removeFromUI(entry: any) {
    // Remove from flat list (legacy)
    if (this.detailedData?.dailySummary?.foods) {
      const entryKey = (entry.foodItemIds ?? []).join(',');
      this.detailedData.dailySummary.foods = this.detailedData.dailySummary.foods
        .filter(f => (f.foodItemIds ?? []).join(',') !== entryKey);
    }
  
    // Remove from entry card
    if (this.detailedData?.dailySummary?.foodEntries) {
      const targetEntry = this.detailedData.dailySummary.foodEntries.find(e => e.foodEntryId === entry.foodEntryId);
      if (targetEntry?.foods) {
        const entryKey = (entry.foodItemIds ?? []).join(',');
        targetEntry.foods = targetEntry.foods
          .filter((f: any) => (f.foodItemIds ?? []).join(',') !== entryKey);
      }
    }
  
    // Clear selection if it was this one
    if (this.selectedFood && this.isSameFood(this.selectedFood, entry)) {
      this.selectedFood = null;
    }
  }
  
  private undoRemoval(foodKey: string) {
    const removedFood = this.removedFoods.get(foodKey);
    if (!removedFood) return;
  
    // Cancel timeout
    const timeoutId = this.undoTimeouts.get(foodKey);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.undoTimeouts.delete(foodKey);
    }
  
    // Restore flat list
    if (this.detailedData?.dailySummary?.foods) {
      this.detailedData.dailySummary.foods.push(removedFood);
    }
  
    // Restore entry card
    if (this.detailedData?.dailySummary?.foodEntries) {
      const targetEntry = this.detailedData.dailySummary.foodEntries.find(e => e.foodEntryId === removedFood.foodEntryId);
      if (targetEntry) {
        targetEntry.foods = targetEntry.foods || [];
        targetEntry.foods.push(removedFood);
      }
    }
  
    this.removedFoods.delete(foodKey);
  }

  entryContainsSelectedFood(entry: any): boolean {
    if (!entry || !this.selectedFood) return false;
    return (entry.foods ?? []).some((f: any) => this.isSameFood(f, this.selectedFood));
  }

  // Helper method to check if an entry contains the food being edited
  entryContainsEditingFood(entry: any): boolean {
    if (!entry || !this.editingFoodKey) return false;
    return (entry.foods ?? []).some((f: any) => this.isEditingFood(f));
  }

  
  

  private confirmRemoval(foodKey: string) {
    const removedFood = this.removedFoods.get(foodKey);
    if (!removedFood) return;

    // Actually delete via API
    this.foodEntryService.deleteFoodEntry(removedFood.foodItemIds).subscribe({
      next: (response) => {
        if (response.isSuccess) {
          // Refresh to get updated data (both foods and nutrients will be recalculated)
          this.loadDetailedSummary(this.dateService.getSelectedDate(), true);
        } else {
          // Restore the food since deletion failed
          this.undoRemoval(foodKey);
          this.showErrorToast('Failed to delete food. Please try again.');
        }
      },
      error: (error) => {
        // Restore the food since deletion failed
        this.undoRemoval(foodKey);
        this.showErrorToast('An error occurred while deleting food.');
      }
    });

    // Clean up
    this.removedFoods.delete(foodKey);
    this.undoTimeouts.delete(foodKey);
  }

  isSameFood(a: any | null, b: any | null): boolean {
    if (!a || !b) return false;
  
    if (a.componentId && b.componentId) return a.componentId === b.componentId;
  
    const aKey = Array.isArray(a.foodItemIds) ? a.foodItemIds.join(',') : '';
    const bKey = Array.isArray(b.foodItemIds) ? b.foodItemIds.join(',') : '';
    if (aKey && bKey) return aKey === bKey;
  
    return (a.name || '').toLowerCase() === (b.name || '').toLowerCase();
  }
  
  
  

  private handleLearnMore(entry: any) {
    const topic = this.getEntryTopicName(entry);
    const localDateKey = this.dateService.getSelectedDate();
    
    // Set context note and navigate to chat immediately
    this.chatService.setContextNote(`Learning more about ${topic}`);
    this.router.navigate(['/app/chat']);
    
    // Make API call in background
    this.chatService.learnMoreAbout(topic, localDateKey).subscribe({
      next: (response) => {
        if (!response.isSuccess) {
          this.showErrorToast('Failed to get information. Please try again.');
        }
      },
      error: (error) => {
        this.showErrorToast('An error occurred while getting information.');
      }
    });
  }

  private getEntryTopicName(entry: any): string {
    // For foods, use the name
    if (entry.entryType === 'food') {
      return entry.name || 'Unknown Food';
    }
    
    // For nutrients, use nutrientName or fallback to nutrientKey
    return entry.nutrientName || entry.nutrientKey || 'Unknown Nutrient';
  }

  private async showErrorToast(message: string) {
    await this.toastService.showToast({
      message,
      duration: 1500,
      color: 'medium'
    });
  }

  // private getFoodDisplayName(food: any): string {
  //   return food.brandName ? `${food.brandName} - ${food.name}` : food.name;
  // }

  // Computed properties for component nutrient categorization
  get selectedComponentMacronutrients() {
    if (!this.selectedComponent?.nutrients) return [];
    const order = ['calories', 'protein', 'fat', 'carbohydrate'];
    return order
      .map(key => this.selectedComponent?.nutrients?.find(n => n.nutrientKey?.toLowerCase() === key.toLowerCase()))
      .filter((n): n is any => !!n);
  }

  get selectedComponentMicronutrients() {
    if (!this.selectedComponent?.nutrients) return [];
    return this.selectedComponent.nutrients
      .filter(n => !['calories', 'protein', 'fat', 'carbohydrate'].includes(n.nutrientKey?.toLowerCase() || ''))
      .sort((a, b) => {
        return ((a as any)['sortOrder'] ?? 9999) - ((b as any)['sortOrder'] ?? 9999);
      }) || [];
  }

  trackByEntryId(index: number, entry: any): string {
    return entry?.foodEntryId || index.toString();
  }
  
  trackById(index: number, item: any): string {
    return item?.componentId
        || (Array.isArray(item?.foodItemIds) ? item.foodItemIds.join(',') : '')
        || item?.nutrientKey
        || item?.name
        || index.toString();
  }

  // Helper method to check if a food is currently being edited
  isEditingFood(food: any): boolean {
    if (!this.editingFoodKey) return false;

    // Create consistent key for comparison
    const foodKey = this.getFoodKey(food);
    return foodKey === this.editingFoodKey;
  }

  private getFoodKey(food: any): string {
    // Create a unique key for the food using the same logic as removal/comparison
    if (food.componentId) return food.componentId;
    if (Array.isArray(food.foodItemIds)) return food.foodItemIds.join(',');
    return food.foodEntryId || food.name || '';
  }

  segmentChanged(event: any) {
    this.viewMode = event.detail.value;
    this.selectedNutrient = null;
    this.selectedFood = null;
    this.selectedComponent = null;

    // Update all selection states
    this.updateAllSelectionStates();
  }

  get hasFoodEntries(): boolean {
    const entries = this.detailedData?.dailySummary?.foodEntries ?? [];
    return entries.some(e => (e.foods?.length ?? 0) > 0);
  }

  /**
   * Convert API data to display models with precomputed values
   */
  private convertToDisplayModels(): void {
    if (!this.detailedData?.dailySummary) return;

    // Convert nutrients to display models
    this.nutrientsDisplay = (this.detailedData.dailySummary.nutrients || []).map(nutrient => {
      const display = new NutrientBreakdownDisplay(nutrient);
      display.computeDisplayValues();
      return display;
    });

    // Convert food entries to display models
    this.foodEntriesDisplay = (this.detailedData.dailySummary.foodEntries || []).map(entry => {
      const display = new FoodEntryBreakdownDisplay(entry);
      display.computeDisplayValues();
      return display;
    });

    // Update selection states
    this.updateAllSelectionStates();
  }

  /**
   * Update selection states across all display models
   */
  private updateAllSelectionStates(): void {
    // Update nutrient selection states
    this.nutrientsDisplay.forEach(nutrient => {
      nutrient.updateSelectionState(this.selectedNutrient ?? undefined);
    });

    // Update food entry selection states
    this.foodEntriesDisplay.forEach(entry => {
      entry.updateSelectionState(this.selectedFood ?? undefined, this.selectedComponent ?? undefined, this.editingFoodKey || undefined);
    });
  }

  // Helper method to check if an item is the last in the list
  isLastItem(selectedItem: any, list: any[]): boolean {
    if (!selectedItem || !list || list.length === 0) {
      return false;
    }
    
    const lastItem = list[list.length - 1];
    
    // For nutrients, compare by nutrientKey
    if (selectedItem.nutrientKey && lastItem.nutrientKey) {
      return selectedItem.nutrientKey === lastItem.nutrientKey;
    }
    
    // For foods, compare by name
    if (selectedItem.name && lastItem.name) {
      return selectedItem.name === lastItem.name;
    }

    return false;
  }

  // Chart methods
  toggleMacroChartView(): void {
    this.showMacroCharts = !this.showMacroCharts;
    if (this.showMacroCharts) {
      this.updateMacroCharts();
    }
  }

  private initializeChartOptions(): void {
    // Calories bar chart options
    this.caloriesChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              return `${context.parsed.y} kcal`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            display: false
          }
        },
        y: {
          beginAtZero: true,
          grid: {
            display: false
          },
          ticks: {
            display: false
          }
        }
      }
    };

    // Macro doughnut chart options
    this.macroChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 10,
            font: {
              size: 11
            }
          }
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              const label = context.label || '';
              const value = context.parsed || 0;
              return `${label}: ${value}%`;
            }
          }
        }
      }
    };
  }

  private updateMacroCharts(): void {
    const macroData = this.chartService.getMacroChartData(this.nutrientsDisplay);

    if (!macroData) return;

    // Round values for display
    const calories = Math.round((macroData.calories || 0) * 10) / 10;
    const caloriesTarget = macroData.caloriesTarget ? Math.round(macroData.caloriesTarget * 10) / 10 : 0;

    // Update calories bar chart
    this.caloriesChartData = {
      labels: ['Calories'],
      datasets: [
        {
          label: 'Consumed',
          data: [calories],
          backgroundColor: '#D64933'
        },
        {
          label: 'Target',
          data: [caloriesTarget],
          backgroundColor: '#A9C8B2'
        }
      ]
    };

    // Update macro doughnut chart
    const proteinPercentage = Math.round(macroData.macroAmounts.protein.percentage || 0);
    const fatPercentage = Math.round(macroData.macroAmounts.fat.percentage || 0);
    const carbsPercentage = Math.round(macroData.macroAmounts.carbs.percentage || 0);

    this.macroChartData = {
      labels: ['Protein', 'Fat', 'Carbs'],
      datasets: [{
        data: [proteinPercentage, fatPercentage, carbsPercentage],
        backgroundColor: [
          '#4E6E5D', // Olive for protein
          '#FF8A5C', // Salmon for fat
          '#D64933'  // Tomato for carbs
        ],
        borderWidth: 0
      }]
    };
  }
}

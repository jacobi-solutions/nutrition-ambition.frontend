import { Component, OnInit, OnDestroy, inject, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonContent, IonCard, IonCardHeader, IonCardTitle, IonCardContent,
  IonSpinner, IonText, IonSegment, IonSegmentButton, IonLabel, IonList,
  IonItem, IonIcon, IonButton, IonPopover, IonRefresher, IonRefresherContent
} from '@ionic/angular/standalone';
import { FormsModule } from '@angular/forms';
import {
  GetDetailedSummaryResponse,
  NutrientBreakdown,
  FoodBreakdown,
  FoodContribution,
  NutritionAmbitionApiService,
  EditFoodSelectionRequest
} from '../../services/nutrition-ambition-api.service';
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
  nutritionOutline
} from 'ionicons/icons';
import { AppHeaderComponent } from 'src/app/components/header/header.component';
import { EntryActionMenuComponent, ActionEvent } from 'src/app/components/entry-action-menu/entry-action-menu.component';
import { ToastService } from 'src/app/services/toast.service';
import { ViewWillEnter } from '@ionic/angular';
import { format } from 'date-fns';
import { FoodSelectionService } from 'src/app/services/food-selection.service';
import { AnalyticsService } from 'src/app/services/analytics.service';

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
    EntryActionMenuComponent
  ]
})
export class DailySummaryPage implements OnInit, OnDestroy, ViewWillEnter {
  @ViewChild('popover') popover: IonPopover;
  @ViewChild(IonContent) content: IonContent;

  detailedData: GetDetailedSummaryResponse | null = null;
  viewMode: 'nutrients' | 'foods' = 'nutrients';
  selectedNutrient: NutrientBreakdown | null = null;
  selectedFood: FoodBreakdown | null = null;
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

  private dailySummaryService = inject(DailySummaryService);
  private authService = inject(AuthService);
  private dateService = inject(DateService);
  private chatService = inject(ChatService);
  private foodEntryService = inject(FoodEntryService);
  private router = inject(Router);
  private toastService = inject(ToastService);
  private apiService = inject(NutritionAmbitionApiService);

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
      nutritionOutline
    });
  }

  ngOnInit() {
    // Firebase Analytics: Track page view on initialization
    this.analytics.trackPageView('DailySummary');
    
    // React to date changes after initial value to prevent duplicate load with ionViewWillEnter
    this.dateSubscription = this.dateService.selectedDate$
      .pipe(skip(1))
      .subscribe(date => {
        this.selectedDate = date;
        this.loadDetailedSummary(this.dateService.getSelectedDateUtc());
        
        // Firebase Analytics: Track page view when date changes
        this.analytics.trackPageView('DailySummary');
      });

    this.authService.userEmail$.subscribe(email => {
      this.userEmail = email;
    });

    // Listen for meal logging events from chat service to refresh data
    this.mealLoggedSubscription = this.chatService.mealLogged$.subscribe(() => {
      console.log('🍽️ Meal logged event received, refreshing summary');
      this.loadDetailedSummary(this.dateService.getSelectedDateUtc(), true);
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
    console.log('📊 Summary tab entered, refreshing data for date:', this.selectedDate);
    // Force reload when entering the tab since user might have added food from chat
    this.selectedDate = this.dateService.getSelectedDate();
    this.loadDetailedSummary(this.dateService.getSelectedDateUtc(), true);
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
    this.loadDetailedSummary(this.dateService.getSelectedDateUtc(), true);
    
    // Complete the refresher if event is provided
    if (event && event.target) {
      setTimeout(() => {
        (event.target as any)?.complete();
      }, 1000);
    }
  }

  loadDetailedSummary(date: Date, forceReload: boolean = false) {
    console.log('🔄 Loading detailed summary for date:', date, forceReload ? '(forced reload)' : '(cached allowed)');
    this.detailedLoading = true;
    this.detailedError = null;
    this.detailedData = null;
    this.selectedNutrient = null;
    this.selectedFood = null;

    this.dailySummaryService.getDetailedSummary(date, forceReload)
      .pipe(
        finalize(() => this.detailedLoading = false),
        catchError(err => {
          console.error(err);
          this.detailedError = 'Failed to load nutrition data.';
          return of(null);
        })
      )
      .subscribe(response => {
        if (response) {
          console.log('✅ Detailed summary loaded successfully:', {
            foodsCount: response.foods?.length || 0,
            nutrientsCount: response.nutrients?.length || 0
          });
          this.detailedData = response;
        }
      });
  }

  // Sort macronutrients in desired fixed order
  get macronutrientList(): NutrientBreakdown[] {
    const order = ['calories', 'protein', 'fat', 'carbohydrate'];
    return order
      .map(key => this.detailedData?.nutrients?.find(n => n.nutrientKey?.toLowerCase() === key.toLowerCase()))
      .filter((n): n is NutrientBreakdown => !!n);
  }

  // Sort micronutrients using sortOrder field (set by backend)
  get micronutrientList(): NutrientBreakdown[] {
    return this.detailedData?.nutrients
      ?.filter(n => !['calories', 'protein', 'fat', 'carbohydrate'].includes(n.nutrientKey?.toLowerCase() || ''))
      ?.sort((a, b) => {
        return (a['sortOrder'] ?? 9999) - (b['sortOrder'] ?? 9999);
      }) || [];
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

  selectNutrient(nutrient: NutrientBreakdown) {
    const isAlreadySelected = this.selectedNutrient?.nutrientKey === nutrient.nutrientKey;
    this.selectedNutrient = isAlreadySelected ? null : nutrient;
    this.selectedFood = null;
    
    // If we're expanding a nutrient, scroll to it after DOM updates
    if (!isAlreadySelected && nutrient && nutrient.nutrientKey) {
      setTimeout(() => {
        this.scrollToSelectedItem('nutrient', nutrient.nutrientKey!);
      }, 150);
    }
  }

  selectFood(food: FoodBreakdown) {
    const isAlreadySelected = this.isSameFood(this.selectedFood, food);
    this.selectedFood = isAlreadySelected ? null : food;
    this.selectedNutrient = null;
    
    // If we're expanding a food, scroll to it after DOM updates
    if (!isAlreadySelected && food) {
      setTimeout(() => {
        this.scrollToSelectedItem('food', food.name || '');
      }, 150);
    }
  }

  

  navigateToFood(foodName: string) {
    this.viewMode = 'foods';
    this.selectedFood = this.detailedData?.foods?.find(f => f.name?.toLowerCase() === foodName.toLowerCase()) || null;
    this.selectedNutrient = null;
    
    // Scroll to the selected food after DOM updates
    setTimeout(() => {
      this.scrollToSelectedItem('food', foodName);
    }, 300);
  }

  navigateToNutrient(nutrientKey: string) {
    this.viewMode = 'nutrients';
    this.selectedNutrient = this.detailedData?.nutrients?.find(n => n.nutrientKey === nutrientKey) || null;
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
        } else {
          console.warn(`Could not find target element for ${type}: ${identifier}`);
        }
      }, 100); // Additional small delay to ensure DOM is fully updated
    } catch (error) {
      console.warn('Failed to scroll to selected item:', error);
    }
  }

  openActionMenu(event: Event, entry: any, type: 'food' | 'nutrient') {
    event.stopPropagation();
    this.popoverEvent = event;
    this.selectedEntry = { ...entry, entryType: type };
    this.isPopoverOpen = true;
  }

  handleActionSelected(event: ActionEvent) {
    this.isPopoverOpen = false;
    if (this.popover) {
      this.popover.dismiss();
    }
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
        console.log('Action not implemented:', event.action);
    }
  }

  private handleEditEntry(entry: any) {
    if (entry.entryType !== 'food') {
      this.showErrorToast('Only food items can be edited.');
      return;
    }
  
    // You should now have these from the backend in each FoodBreakdown:
    // entry.foodEntryId, entry.groupId, entry.itemSetId  (we only need foodEntryId to start)
    if (!entry.foodEntryId) {
      console.warn('No foodEntryId on entry; cannot start edit.');
      this.showErrorToast('Sorry, could not locate this food to edit.');
      return;
    }
  
    const displayName = this.getFoodDisplayName(entry);
  
    // Start the pending edit state immediately
    this.chatService.startPendingEdit(displayName);
    
    // UX: set context note and navigate to Chat
    this.chatService.setContextNote(`Editing ${displayName}`);
    this.router.navigate(['/app/chat']);
  
    const req = new EditFoodSelectionRequest({
      foodEntryId: entry.foodEntryId,
      groupId: entry.groupId,
      itemSetId: entry.itemSetId,
      loggedDateUtc: this.dateService.getSelectedDateUtc()
    });
  
    this.foodSelectionService.startEditFoodSelection(req).subscribe({
      next: (resp) => {
        if (!resp?.isSuccess) {
          this.showErrorToast('Failed to start edit. Please try again.');
          this.chatService.clearPendingEdit(); // Clear on error
        } else {
          // Complete the pending edit with the returned messages
          this.chatService.completePendingEdit(resp.messages);
        }
      },
      error: (err) => {
        console.error('Edit start error', err);
        this.showErrorToast('An error occurred while starting the edit.');
        this.chatService.clearPendingEdit(); // Clear on error
      }
    });
  }
  
  
  
  private async handleRemoveEntry(entry: any) {
    
    this.isPopoverOpen = false;
    // Only allow removal of food entries, not nutrients
    if (entry.entryType !== 'food') {
      await this.toastService.showToast({
        message: 'Only food items can be removed.',
        duration: 3000,
        color: 'medium'
      });
      return;
    }

    if (!entry.foodItemIds || entry.foodItemIds.length === 0) {
      console.error('No food item IDs found for removal');
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
    if (this.detailedData?.foods) {
      const entryKey = (entry.foodItemIds ?? []).join(',');
      this.detailedData.foods = this.detailedData.foods
        .filter(f => (f.foodItemIds ?? []).join(',') !== entryKey);
    }
  
    // Remove from entry card
    if (this.detailedData?.foodEntries) {
      const targetEntry = this.detailedData.foodEntries.find(e => e.foodEntryId === entry.foodEntryId);
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
    if (this.detailedData?.foods) {
      this.detailedData.foods.push(removedFood);
    }
  
    // Restore entry card
    if (this.detailedData?.foodEntries) {
      const targetEntry = this.detailedData.foodEntries.find(e => e.foodEntryId === removedFood.foodEntryId);
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

  
  

  private confirmRemoval(foodKey: string) {
    const removedFood = this.removedFoods.get(foodKey);
    if (!removedFood) return;

    // Actually delete via API
    this.foodEntryService.deleteFoodEntry(removedFood.foodItemIds).subscribe({
      next: (response) => {
        if (response.isSuccess) {
          console.log('Food successfully deleted from backend');
          // Refresh to get updated data (both foods and nutrients will be recalculated)
          this.loadDetailedSummary(this.dateService.getSelectedDateUtc(), true);
          
        } else {
          console.error('Failed to delete food:', response.errors);
          // Restore the food since deletion failed
          this.undoRemoval(foodKey);
          this.showErrorToast('Failed to delete food. Please try again.');
        }
      },
      error: (error) => {
        console.error('Error deleting food:', error);
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
  
    if (a.itemSetId && b.itemSetId) return a.itemSetId === b.itemSetId;
  
    const aKey = Array.isArray(a.foodItemIds) ? a.foodItemIds.join(',') : '';
    const bKey = Array.isArray(b.foodItemIds) ? b.foodItemIds.join(',') : '';
    if (aKey && bKey) return aKey === bKey;
  
    return (a.name || '').toLowerCase() === (b.name || '').toLowerCase();
  }
  
  
  

  private handleLearnMore(entry: any) {
    const topic = this.getEntryTopicName(entry);
    const date = this.dateService.getSelectedDateUtc();
    
    // Set context note and navigate to chat immediately
    this.chatService.setContextNote(`Learning more about ${topic}`);
    this.router.navigate(['/app/chat']);
    
    // Make API call in background
    this.chatService.learnMoreAbout(topic, date).subscribe({
      next: (response) => {
        if (!response.isSuccess) {
          this.showErrorToast('Failed to get information. Please try again.');
        }
      },
      error: (error) => {
        console.error('Error learning more about topic:', error);
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
      duration: 3000,
      color: 'medium'
    });
  }

  private getFoodDisplayName(food: any): string {
    return food.brandName ? `${food.brandName} - ${food.name}` : food.name;
  }

  trackByEntryId(index: number, entry: any): string {
    return entry?.foodEntryId || index.toString();
  }
  
  trackById(index: number, item: any): string {
    return item?.itemSetId 
        || (Array.isArray(item?.foodItemIds) ? item.foodItemIds.join(',') : '') 
        || item?.nutrientKey 
        || item?.name 
        || index.toString();
  }

  segmentChanged(event: any) {
    this.viewMode = event.detail.value;
    this.selectedNutrient = null;
    this.selectedFood = null;
  }

  get hasFoodEntries(): boolean {
    const entries = this.detailedData?.foodEntries ?? [];
    return entries.some(e => (e.foods?.length ?? 0) > 0);
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
}

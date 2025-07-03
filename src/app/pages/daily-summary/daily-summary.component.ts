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
  NutritionAmbitionApiService
} from '../../services/nutrition-ambition-api.service';
import { catchError, finalize, of, Subscription } from 'rxjs';
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
import { ToastController } from '@ionic/angular';
import { ViewWillEnter } from '@ionic/angular';

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
export class DailySummaryComponent implements OnInit, OnDestroy, ViewWillEnter {
  @ViewChild('popover') popover: IonPopover;
  @ViewChild(IonContent) content: IonContent;

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
  private toastController = inject(ToastController);
  private apiService = inject(NutritionAmbitionApiService);

  constructor(private elementRef: ElementRef) {
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
    this.dateSubscription = this.dateService.selectedDate$.subscribe(date => {
      this.selectedDate = date;
      this.loadDetailedSummary(new Date(date));
    });

    this.authService.userEmail$.subscribe(email => {
      this.userEmail = email;
    });

    // Listen for meal logging events from chat service to refresh data
    this.mealLoggedSubscription = this.chatService.mealLogged$.subscribe(() => {
      console.log('🍽️ Meal logged event received, refreshing summary');
      this.loadDetailedSummary(new Date(this.selectedDate), true);
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
    this.loadDetailedSummary(new Date(this.selectedDate), true);
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
      this.router.navigate(['/auth']);
    });
  }

  handleRefresh(event: CustomEvent) {
    this.loadDetailedSummary(new Date(this.selectedDate), true);
    setTimeout(() => (event.target as any)?.complete(), 1000);
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

  selectNutrient(nutrient: NutrientBreakdown) {
    this.selectedNutrient = this.selectedNutrient?.nutrientKey === nutrient.nutrientKey ? null : nutrient;
    this.selectedFood = null;
  }

  selectFood(food: FoodBreakdown) {
    this.selectedFood = this.selectedFood?.name === food.name ? null : food;
    this.selectedNutrient = null;
  }

  navigateToFood(foodName: string) {
    this.viewMode = 'foods';
    this.selectedFood = this.detailedData?.foods?.find(f => f.name?.toLowerCase() === foodName.toLowerCase()) || null;
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
      case 'focusInChat':
        this.handleFocusInChat(event.entry);
        break;
      case 'learn':
        this.handleLearnMore(event.entry);
        break;
      default:
        console.log('Action not implemented:', event.action);
    }
  }

  private async handleRemoveEntry(entry: any) {
    
    this.isPopoverOpen = false;
    // Only allow removal of food entries, not nutrients
    if (entry.entryType !== 'food') {
      const toast = await this.toastController.create({
        message: 'Only food items can be removed.',
        duration: 3000,
        color: 'warning',
        position: 'bottom'
      });
      await toast.present();
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
    const toast = await this.toastController.create({
      message: `Removing "${foodName}"`,
      duration: 2000,
      color: 'medium',
      position: 'bottom',
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

    await toast.present();

    // Set timeout to actually delete after toast duration
    const timeoutId = setTimeout(() => {
      this.confirmRemoval(foodKey);
    }, 4000);

    this.undoTimeouts.set(foodKey, timeoutId);
  }

  private removeFromUI(entry: any) {
    if (!this.detailedData?.foods) return;

    // Remove the food from the UI
    this.detailedData.foods = this.detailedData.foods.filter(food => {
      // Compare by food item IDs
      const foodKey = food.foodItemIds?.join(',');
      const entryKey = entry.foodItemIds?.join(',');
      return foodKey !== entryKey;
    });

    // Clear selected food if it was the one being removed
    if (this.selectedFood && this.selectedFood.foodItemIds?.join(',') === entry.foodItemIds?.join(',')) {
      this.selectedFood = null;
    }
  }

  private undoRemoval(foodKey: string) {
    const removedFood = this.removedFoods.get(foodKey);
    if (!removedFood) return;

    // Clear the timeout
    const timeoutId = this.undoTimeouts.get(foodKey);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.undoTimeouts.delete(foodKey);
    }

    // Restore the food to the UI
    if (this.detailedData?.foods) {
      this.detailedData.foods.push(removedFood);
      // Re-sort foods to maintain original order (if needed)
      // For now, just add to end
    }

    // Clean up
    this.removedFoods.delete(foodKey);
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
          this.loadDetailedSummary(new Date(this.selectedDate), true);
          
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

  private handleFocusInChat(entry: any) {
    const topic = this.getEntryTopicName(entry);
    const date = new Date(this.selectedDate);
    
    // Set context note and navigate to chat immediately
    this.chatService.setContextNote(`Focusing on ${topic}`);
    this.router.navigate(['/app/chat']);
    
    // Make API call in background
    this.chatService.focusInChat(topic, date).subscribe({
      next: (response) => {
        if (!response.isSuccess) {
          this.showErrorToast('Failed to focus in chat. Please try again.');
        }
      },
      error: (error) => {
        console.error('Error focusing in chat:', error);
        this.showErrorToast('An error occurred while focusing in chat.');
      }
    });
  }

  private handleLearnMore(entry: any) {
    const topic = this.getEntryTopicName(entry);
    const date = new Date(this.selectedDate);
    
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
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      color: 'danger',
      position: 'bottom'
    });
    await toast.present();
  }

  private getFoodDisplayName(food: any): string {
    return food.brandName ? `${food.brandName} - ${food.name}` : food.name;
  }

  trackById(index: number, item: any): string {
    return item?.id || item?.nutrientKey || item?.name || index.toString();
  }

  segmentChanged(event: any) {
    this.viewMode = event.detail.value;
    this.selectedNutrient = null;
    this.selectedFood = null;
  }

  get hasFoodEntries(): boolean {
    return !!this.detailedData?.foods?.length;
  }
}

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ModalController } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { NutritionAmbitionApiService, GetFoodEntriesRequest, GetFoodEntriesResponse, FoodEntry, FoodGroup, FoodItem } from 'src/app/services/nutrition-ambition-api.service';
import { AuthService } from 'src/app/services/auth.service';
import { finalize } from 'rxjs/operators';

// 🟢 Import the new FoodGroupDetailModalComponent
import { FoodGroupDetailModalComponent } from '../../modals/food-group-detail/food-group-detail.modal';

@Component({
  selector: 'app-nutrition-log',
  templateUrl: './nutrition-log.page.html',
  styleUrls: ['./nutrition-log.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonicModule,
    FormsModule,
    // 🟢 Import the modal component here so it can be used
    // FoodGroupDetailModalComponent 
  ]
})
export class NutritionLogPage implements OnInit {

  selectedDate: string = new Date().toISOString();
  isLoading: boolean = false;
  errorMessage: string = '';
  foodEntries: FoodEntry[] = [];
  dailySummary: any = null;

  constructor(
    private nutritionApiService: NutritionAmbitionApiService,
    private authService: AuthService,
    private modalCtrl: ModalController
  ) { }

  ngOnInit() {
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

    const request = new GetFoodEntriesRequest({
      loggedDateUtc: new Date(this.selectedDate)
    });

    this.nutritionApiService.getFoodEntries(request)
      .pipe(finalize(() => this.isLoading = false))
      .subscribe({
        next: (response: GetFoodEntriesResponse) => {
          if (response && response.isSuccess) {
            this.foodEntries = response.foodEntries || [];
            this.dailySummary = {
              totalCalories: response.totalCalories,
              totalProtein: response.totalProtein,
              totalCarbs: response.totalCarbs,
              totalFat: response.totalFat
            };
          } else {
            if (response?.errors && Array.isArray(response.errors)) {
              this.errorMessage = response.errors.map(err => err.errorMessage).join(', ');
            } else {
              this.errorMessage = 'Failed to load log data.';
            }
          }
        },
        error: (err) => {
          console.error('Error loading nutrition log:', err);
          let msg = 'An unknown error occurred while loading the log.';
          if (typeof err === 'string') {
            msg = err;
          } else if (err?.message && typeof err.message === 'string') {
            msg = err.message;
          } else if (err?.error) {
            if (typeof err.error === 'string') {
              msg = err.error;
            } else if (err.error?.message && typeof err.error.message === 'string') {
              msg = err.error.message;
            }
          }
          this.errorMessage = msg;
        }
      });
  }

  // 🟢 Updated to use FoodGroupDetailModalComponent
  async viewGroupDetails(entry: FoodEntry, group: FoodGroup) {
    const modal = await this.modalCtrl.create({
      component: FoodGroupDetailModalComponent, // Use the new modal
      componentProps: {
        groupName: group.groupName,
        items: group.items,
        entryTime: entry.loggedDateUtc
      }
    });
    await modal.present();
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

  // Updated helper function to calculate total calories for a single FoodEntry using GroupedItems
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


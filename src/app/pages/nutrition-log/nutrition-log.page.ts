import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ModalController } from '@ionic/angular'; // Import ModalController
import { FormsModule } from '@angular/forms';
import { NutritionAmbitionApiService, GetFoodEntriesRequest, GetFoodEntriesResponse, FoodEntry, FoodItem } from 'src/app/services/nutrition-ambition-api.service';
import { AuthService } from 'src/app/services/auth.service';
import { finalize } from 'rxjs/operators';

// Import the new modal component
import { FoodEntryDetailModalComponent } from '../../modals/food-entry-detail/food-entry-detail.modal';

@Component({
  selector: 'app-nutrition-log',
  templateUrl: './nutrition-log.page.html',
  styleUrls: ['./nutrition-log.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonicModule, // Keep IonicModule here for ion-item, ion-label etc. used in template
    FormsModule,
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
    private modalCtrl: ModalController // Inject ModalController
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
            // Refined error message handling from response
            if (response?.errors && Array.isArray(response.errors)) {
              this.errorMessage = response.errors.map(err => err.errorMessage).join(', ');
            } else {
              this.errorMessage = 'Failed to load log data.'; // Default if errors format is unexpected
            }
          }
        },
        error: (err) => {
          console.error('Error loading nutrition log:', err);
          // Refined error message handling from error object
          let msg = 'An unknown error occurred while loading the log.'; // Default
          if (typeof err === 'string') {
            msg = err;
          } else if (err?.message && typeof err.message === 'string') { // Check err exists before accessing message
            msg = err.message;
          } else if (err?.error) { // Check err exists before accessing error
            if (typeof err.error === 'string') {
              msg = err.error;
            } else if (err.error?.message && typeof err.error.message === 'string') { // Check error.message exists
              msg = err.error.message;
            }
          }
          this.errorMessage = msg;
        }
      });
  }

  // Updated method to open the FoodEntryDetailModalComponent
  async viewItemDetails(entry: FoodEntry) {
    const modal = await this.modalCtrl.create({
      component: FoodEntryDetailModalComponent,
      componentProps: {
        foodEntry: entry // Pass the selected FoodEntry object to the modal
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

  // 🟢 Helper function to calculate total calories for a single FoodEntry
  calculateEntryCalories(entry: FoodEntry): number {
    if (!entry || !entry.parsedItems) {
      return 0;
    }
    return entry.parsedItems.reduce((sum, item) => sum + (item.calories || 0), 0);
  }
}


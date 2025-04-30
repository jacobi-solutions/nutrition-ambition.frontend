import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { FoodEntry, FoodGroup, FoodItem } from 'src/app/services/nutrition-ambition-api.service';
import { finalize } from 'rxjs/operators';

// Import NutritionLogService
import { NutritionLogService } from 'src/app/services/nutrition-log.service';
import { AppHeaderComponent } from '../../components/app-header/app-header.component';

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

  constructor(
    private nutritionLogService: NutritionLogService,
    private router: Router
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

    this.nutritionLogService.getLogByDate(this.selectedDate)
      .pipe(finalize(() => this.isLoading = false))
      .subscribe({
        next: (response) => {
          this.foodEntries = response.foodEntries || [];
          this.dailySummary = this.nutritionLogService.formatSummary(response);
        },
        error: (err) => {
          console.error('Error loading log:', err);
          this.errorMessage = err?.message || 'Failed to load log data.';
        }
      });
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


import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { FoodEntryService } from '../../services/food-entry/food-entry.service';
import { FoodEntry, FoodItem, GetFoodEntriesResponse } from '../../services/nutrition-ambition-api.service';
import { FoodEntryComponent } from '../../components/food-entry/food-entry.component';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: true,
  imports: [IonContent, IonHeader, IonTitle, IonToolbar, CommonModule, FormsModule, FoodEntryComponent]
})
export class HomePage implements OnInit {
  dailyEntries: FoodEntry[] = [];
  totalCalories: number = 0;
  totalProtein: number = 0;
  totalCarbs: number = 0;
  totalFat: number = 0;
  errorMessage: string = '';

  constructor(private foodEntryService: FoodEntryService) {}

  ngOnInit() {
    this.loadDailyEntries();
  }

  loadDailyEntries() {
    this.foodEntryService.getDailyEntries(new Date()).subscribe(
      (response: GetFoodEntriesResponse) => {
        if (response?.isSuccess && response.foodEntries?.length) {
          this.dailyEntries = response.foodEntries ?? [];
          this.calculateTotals();
        } else {
          this.errorMessage = 'No entries found for today.';
          this.dailyEntries = [];
        }
      },
      () => {
        this.errorMessage = 'Failed to load daily entries.';
      }
    );
  }

  calculateTotals() {
    this.totalCalories = 0;
    this.totalProtein = 0;
    this.totalCarbs = 0;
    this.totalFat = 0;

    this.dailyEntries.forEach((entry) => {
      entry.parsedItems?.forEach((item: FoodItem) => {
        this.totalCalories += item.calories ?? 0;
        this.totalProtein += item.protein ?? 0;
        this.totalCarbs += item.carbohydrates ?? 0;
        this.totalFat += item.fat ?? 0;
      });
    });
  }

  onEntryAdded() {
    this.loadDailyEntries(); // Refresh the daily log after adding an entry
  }
}

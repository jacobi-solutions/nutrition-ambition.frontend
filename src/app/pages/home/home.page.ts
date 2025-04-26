import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { FoodEntryService } from '../../services/food-entry.service';
import { FoodEntry, FoodItem, GetFoodEntriesResponse } from '../../services/nutrition-ambition-api.service';
import { FoodEntryComponent } from '../../components/food-entry/food-entry.component';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: true,
  imports: [IonContent, IonHeader, IonTitle, IonToolbar, CommonModule, FormsModule, FoodEntryComponent]
})
export class HomePage implements OnInit, OnDestroy {
  dailyEntries: FoodEntry[] = [];
  totalCalories: number = 0;
  totalProtein: number = 0;
  totalCarbs: number = 0;
  totalFat: number = 0;
  errorMessage: string = '';
  userEmail: string | null = null;
  private userEmailSubscription: Subscription;

  constructor(private foodEntryService: FoodEntryService, private authService: AuthService, private router: Router) {}

  ngOnInit() {
    this.userEmailSubscription = this.authService.userEmailSubject.subscribe(email => {
      this.userEmail = email;
      if (email) {
        this.loadDailyEntries();
      }
    });

  }

  ngOnDestroy() {
    if (this.userEmailSubscription) {
      this.userEmailSubscription.unsubscribe();
    }
  }

  loadDailyEntries() {
    this.foodEntryService.getDailyEntries().subscribe(
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

  async signOut() {
    try {
      await this.authService.signOutUser();
      this.router.navigate(['/login']); // Redirect to login page
    } catch (error) {
      console.error('Error signing out:', error);
    }
  }
}

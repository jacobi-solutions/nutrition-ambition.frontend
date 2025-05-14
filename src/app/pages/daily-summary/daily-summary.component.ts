import { Component, OnInit, OnDestroy, inject } from '@angular/core';
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
  IonText
} from '@ionic/angular/standalone';
import { NutritionSummaryResponse } from '../../services/nutrition-ambition-api.service';
import { catchError, finalize, of, Subscription } from 'rxjs';
import { DailySummaryService } from 'src/app/services/daily-summary.service';
import { AccountsService } from 'src/app/services/accounts.service';
import { AuthService } from 'src/app/services/auth.service';
import { DateService } from 'src/app/services/date.service';
import { MacronutrientsSummary } from '../../services/nutrition-ambition-api.service';
import { AppHeaderComponent } from '../../components/app-header/header.component';
import { Router } from '@angular/router';

@Component({
  selector: 'app-daily-summary',
  templateUrl: './daily-summary.component.html',
  styleUrls: ['./daily-summary.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
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
    AppHeaderComponent
  ]
})
export class DailySummaryComponent implements OnInit, OnDestroy {
  summaryData: NutritionSummaryResponse | null = null;
  loading = false;
  error: string | null = null;
  isEmptySummary = false;
  selectedDate: string = new Date().toISOString();
  userEmail: string | null = null;
  private dateSubscription: Subscription;
  
  // Use the inject function for dependency injection in standalone components
  private dailySummaryService = inject(DailySummaryService);
  private accountsService = inject(AccountsService);
  private authService = inject(AuthService);
  private dateService = inject(DateService);
  private router = inject(Router);

  ngOnInit() {
    // Subscribe to date changes
    this.dateSubscription = this.dateService.selectedDate$.subscribe(date => {
      this.selectedDate = date;
      this.loadSummary(new Date(date));
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

  loadSummary(date: Date) {
    // Check for account ID - if missing, show empty summary
    const accountId = this.accountsService.getAccountId();
    if (!accountId) {
      this.createEmptySummary();
      return;
    }
    
    this.loading = true;
    this.error = null;
    this.summaryData = null; // Reset summary data
    this.isEmptySummary = false;

    this.dailySummaryService.getDailySummary(date)
      .pipe(
        catchError(error => {
          console.error('Error loading daily summary:', error);
          this.error = 'Unable to load nutrition summary. Please try again later.';
          return of(null as NutritionSummaryResponse | null);
        }),
        finalize(() => {
          this.loading = false;
          console.log('Loading set to false'); // Debug log
        })
      )
      .subscribe({
        next: (result: NutritionSummaryResponse | null) => {
          if (result) {
            this.summaryData = result;
            console.log('Summary data received:', result);
          } else {
            // No data returned, create empty summary
            this.createEmptySummary();
          }
        },
        error: (err) => {
          console.error('Subscription error:', err);
        },
        complete: () => {
          console.log('Subscription complete');
        }
      });
  }
  
  // Create an empty summary with zeroed values
  createEmptySummary() {
    this.isEmptySummary = true;
    const today = new Date();
    
    const emptyMacros = new MacronutrientsSummary({
      protein: 0,
      carbohydrates: 0,
      fat: 0,
      fiber: 0,
      sugar: 0,
      saturatedFat: 0
    });
    
    this.summaryData = new NutritionSummaryResponse({
      periodStart: today,
      periodEnd: today,
      totalCalories: 0,
      macronutrients: emptyMacros,
      micronutrients: {}
    });
  }
  
  // Helper method to get micronutrients as an array for display
  getMicronutrients(): { name: string; value: number }[] {
    if (!this.summaryData?.micronutrients) {
      return [];
    }
    
    return Object.entries(this.summaryData.micronutrients as Record<string, number>).map(([name, value]) => ({
      name,
      value
    }));
  }
  
  // Helper method to check if all values are zero
  hasZeroValues(): boolean {
    if (!this.summaryData) return true;
    
    return this.summaryData.totalCalories === 0 &&
           this.summaryData.macronutrients?.protein === 0 &&
           this.summaryData.macronutrients?.carbohydrates === 0 &&
           this.summaryData.macronutrients?.fat === 0;
  }
} 
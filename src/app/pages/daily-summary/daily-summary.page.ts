import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { NutritionAmbitionApiService, DailySummaryResponse } from 'src/app/services/nutrition-ambition-api.service';
import { AppHeaderComponent } from 'src/app/components/app-header/app-header.component';
import { DailySummaryCardComponent } from 'src/app/components/daily-summary-card/daily-summary-card.component';
import { AuthService } from 'src/app/services/auth.service';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-daily-summary',
  standalone: true,
  imports: [CommonModule, IonicModule, AppHeaderComponent, DailySummaryCardComponent],
  templateUrl: './daily-summary.page.html',
  styleUrls: ['./daily-summary.page.scss']
})
export class DailySummaryPage implements OnInit {
  summary: DailySummaryResponse | null = null;
  public isLoading: boolean = true;
  public error: string | null = null;
  selectedDate: Date = new Date();
  
  // Threshold for saturated fat warning
  readonly PERSONAL_THRESHOLD: number = 20; // grams - adjust as needed

  constructor(
    private api: NutritionAmbitionApiService,
    private authService: AuthService,
    private router: Router
  ) {}

  async ngOnInit() {
    try {
      const accountId = this.authService.isAuthenticated() ? 'current-user' : '';
      this.summary = await firstValueFrom(this.api.getTotals(accountId));
    } catch (e: any) {
      this.error = e.message || 'Failed to load daily summary';
      console.error('Error loading daily summary:', e);
    } finally {
      this.isLoading = false;
    }
  }
  
  public goToLog() {
    this.router.navigate(['/app/log']);
  }

  public viewFoodsForNutrient(nutrient: string) {
    console.log(`View foods for nutrient: ${nutrient}`);
    // To be implemented: Navigate to a view that shows food items that contribute to this nutrient
  }
} 
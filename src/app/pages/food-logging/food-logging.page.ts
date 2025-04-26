import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { NutritionVisualizationComponent } from './nutrition-visualization/nutrition-visualization.component';
import { FoodTextInputComponent } from './food-text-input/food-text-input.component';
import { ParsedFoodItemsComponent } from './parsed-food-items/parsed-food-items.component';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-food-logging',
  templateUrl: './food-logging.page.html',
  styleUrls: ['./food-logging.page.scss'],
  standalone: true,
  imports: [
    CommonModule, 
    IonicModule,
    FoodTextInputComponent,
    ParsedFoodItemsComponent,
    NutritionVisualizationComponent
  ]
})
export class FoodLoggingPage {
  parsedFoodData: any = null;
  nutritionData: any = null;
  userEmail: string | null = null;
  private userEmailSubscription: Subscription;

  constructor(private authService: AuthService, private router: Router) {
    this.userEmailSubscription = this.authService.userEmail$.subscribe(email => {
      this.userEmail = email;
    });
  }

  ngOnDestroy() {
    if (this.userEmailSubscription) {
      this.userEmailSubscription.unsubscribe();
    }
  }

  onParsedFoodData(data: any) {
    this.parsedFoodData = data;
    // Reset nutrition data when new food is parsed
    this.nutritionData = null;
  }

  onNutritionData(data: any) {
    this.nutritionData = data;
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

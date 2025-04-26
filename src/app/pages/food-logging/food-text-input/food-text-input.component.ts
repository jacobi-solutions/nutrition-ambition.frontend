import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { finalize } from 'rxjs/operators';
import { NutritionAmbitionApiService, ParseFoodTextRequest } from 'src/app/services/nutrition-ambition-api.service';

@Component({
  selector: 'app-food-text-input',
  templateUrl: './food-text-input.component.html',
  styleUrls: ['./food-text-input.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule]
})
export class FoodTextInputComponent implements OnInit {
  @Output() parsedFoodData = new EventEmitter<any>();
  
  foodDescription: string = '';
  isLoading: boolean = false;
  errorMessage: string = '';

  constructor(private nutritionApiService: NutritionAmbitionApiService) { }

  ngOnInit() {}

  submitFoodText() {
    if (!this.foodDescription.trim()) {
      this.errorMessage = 'Please enter a food description';
      return;
    }

    this.errorMessage = '';
    this.isLoading = true;

    const request = new ParseFoodTextRequest({ foodDescription: this.foodDescription });
    

    this.nutritionApiService.parseFoodText(request)
      .pipe(
        finalize(() => this.isLoading = false)
      )
      .subscribe({
        next: (response) => {
          if (response && response.success) {
            this.parsedFoodData.emit(response);
          } else {
            this.errorMessage = 'Failed to parse food text. Please try again.';
          }
        },
        error: (error) => {
          console.error('Error parsing food text:', error);
          this.errorMessage = 'An error occurred while parsing food text. Please try again.';
        }
      });
  }

  clearInput() {
    this.foodDescription = '';
    this.errorMessage = '';
  }
}

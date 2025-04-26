import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonInput, IonButton, IonList, IonicModule } from '@ionic/angular';
import { FoodEntryService } from '../../services/food-entry.service';
import { catchError } from 'rxjs/operators';
import { of, Subscription } from 'rxjs';
import { FoodEntry, GetFoodEntriesResponse } from 'src/app/services/nutrition-ambition-api.service';
import { AuthService } from 'src/app/services/auth.service';

@Component({
  selector: 'app-food-entry',
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule],
  templateUrl: './food-entry.component.html',
  styleUrls: ['./food-entry.component.scss']
})
export class FoodEntryComponent {
  description: string = '';
  entries: FoodEntry[] = [];
  errorMessage: string = '';
  userEmail: string | null = null;
  private userEmailSubscription: Subscription;

  constructor(private foodEntryService: FoodEntryService, private _authService: AuthService) {

    
  }

  ngOnInit() {
    this.userEmailSubscription = this._authService.userEmail$.subscribe(email => {
      this.userEmail = email;
      if (email) {
        this.loadEntries();
      }
    });

  }

  addEntry() {
    this.foodEntryService.addFoodEntry(this.description)
      .pipe(
        catchError(error => {
          this.errorMessage = 'Failed to add entry';
          return of(null);
        })
      )
      .subscribe(response => {
        if (response) {
          this.loadEntries();
          this.description = '';
        }
      });
  }

  loadEntries() {
    this.foodEntryService.getDailyEntries()
      .pipe(
        catchError(error => {
          this.errorMessage = 'Failed to load entries';
          return of({ foodEntries: [] });
        })
      )
      .subscribe((response: GetFoodEntriesResponse | { foodEntries: FoodEntry[] }) => {
        this.entries = response.foodEntries ?? [];
      });
  }
} 
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { DailySummaryResponse } from 'src/app/services/nutrition-ambition-api.service';

@Component({
  selector: 'app-daily-summary-card',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './daily-summary-card.component.html',
  styleUrls: ['./daily-summary-card.component.scss']
})
export class DailySummaryCardComponent {
  @Input() summary: DailySummaryResponse | null = null;
  @Input() isToday: boolean = false;
  @Input() date: Date | null = null;
  @Output() viewLog = new EventEmitter<void>();
  @Output() viewByNutrient = new EventEmitter<string>();

  get nutrients() {
    if (!this.summary) return [];
    return [
      { name: 'Calories', value: this.summary.totalCalories, unit: '' },
      { name: 'Protein', value: this.summary.totalProtein, unit: 'g' },
      { name: 'Carbs', value: this.summary.totalCarbohydrates, unit: 'g' },
      { name: 'Fat', value: this.summary.totalFat, unit: 'g' }
    ];
  }
} 
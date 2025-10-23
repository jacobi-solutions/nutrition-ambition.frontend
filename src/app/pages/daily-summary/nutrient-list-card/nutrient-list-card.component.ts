import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { NutrientBreakdownDisplay } from '../../../models/daily-summary-display';

@Component({
  selector: 'app-nutrient-list-card',
  templateUrl: './nutrient-list-card.component.html',
  styleUrls: ['./nutrient-list-card.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule]
})
export class NutrientListCardComponent {
  @Input() title: string = '';
  @Input() nutrients: NutrientBreakdownDisplay[] = [];
  @Input() selectedNutrient: NutrientBreakdownDisplay | null = null;

  @Output() nutrientSelected = new EventEmitter<NutrientBreakdownDisplay>();
  @Output() actionMenuOpened = new EventEmitter<{ event: Event; nutrient: NutrientBreakdownDisplay }>();
  @Output() foodNavigated = new EventEmitter<string>();

  selectNutrient(nutrient: NutrientBreakdownDisplay): void {
    this.nutrientSelected.emit(nutrient);
  }

  openActionMenu(event: Event, nutrient: NutrientBreakdownDisplay): void {
    this.actionMenuOpened.emit({ event, nutrient });
  }

  navigateToFood(foodName: string): void {
    if (foodName) {
      this.foodNavigated.emit(foodName);
    }
  }

  formatConsumedTarget(nutrient: NutrientBreakdownDisplay): string {
    const amount = nutrient.totalAmount || 0;
    const unit = nutrient.unit || 'mg';
    const formattedAmount = `${amount.toFixed(unit === 'kcal' ? 0 : 1)} ${unit}`;
    const min = nutrient.minTarget;
    const max = nutrient.maxTarget;

    const formatValue = (v: number) => v >= 10 ? v.toFixed(0) : v.toFixed(1).replace(/\.0$/, '');

    if (min != null && max != null) {
      if (min === max) return `${formattedAmount} / ≤ ${formatValue(max)} ${unit}`;
      return `${formattedAmount} / (${formatValue(min)} - ${formatValue(max)} ${unit})`;
    } else if (max != null) {
      return `${formattedAmount} / ≤ ${formatValue(max)} ${unit}`;
    } else if (min != null) {
      return `${formattedAmount} / ≥ ${formatValue(min)} ${unit}`;
    }

    return formattedAmount;
  }

  formatAmountWithFoodUnit(food: any): string {
    if (food.amount != null && food.unit) {
      return `${food.amount.toFixed(1)}${food.unit}`;
    }
    return '';
  }

  isLastItem(nutrient: NutrientBreakdownDisplay, list: NutrientBreakdownDisplay[]): boolean {
    return list.indexOf(nutrient) === list.length - 1;
  }

  trackById(index: number, item: any): any {
    return item.id || item.nutrientKey || index;
  }
}

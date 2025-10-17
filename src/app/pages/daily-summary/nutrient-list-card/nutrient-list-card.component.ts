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
    const consumed = nutrient.totalAmount != null ? nutrient.totalAmount.toFixed(1) : '0.0';
    const target = nutrient.minTarget != null ? nutrient.minTarget.toFixed(1) : '0.0';
    const unit = nutrient.unit || 'g';
    return `${consumed}${unit} / ${target}${unit}`;
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

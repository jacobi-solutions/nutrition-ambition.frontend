import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon, IonGrid, IonRow, IonCol } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { chevronUpOutline, chevronDownOutline, trashOutline } from 'ionicons/icons';
import { ServingQuantityInputComponent } from 'src/app/components/serving-quantity-input.component/serving-quantity-input.component';

@Component({
  selector: 'app-food-header',
  templateUrl: './food-header.component.html',
  styleUrls: ['./food-header.component.scss'],
  standalone: true,
  imports: [CommonModule, IonIcon, IonGrid, IonRow, IonCol, ServingQuantityInputComponent]
})
export class FoodHeaderComponent implements OnInit, OnChanges {
  @Input() food: any = null;
  @Input() foodIndex: number = 0;
  @Input() isReadOnly: boolean = false;
  @Input() isExpanded: boolean = false;
  @Input() currentQuantity: number = 1;

  @Output() toggleExpansion = new EventEmitter<number>();
  @Output() quantityChanged = new EventEmitter<{foodIndex: number, quantity: number}>();
  @Output() removeFood = new EventEmitter<string>();

  // Precomputed values for performance
  displayName: string = '';
  servingLabel: string = '';
  computedShouldShowQuantityInput: boolean = false;
  computedShouldShowNormalLabel: boolean = false;

  // Macro display
  shouldShowMacros: boolean = false;
  shouldShowCaloriesOnly: boolean = false;
  macroSummary: string = '';

  constructor() {
    addIcons({ chevronUpOutline, chevronDownOutline, trashOutline });
  }

  ngOnInit(): void {
    this.computeDisplayValues();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['food'] || changes['currentQuantity'] || changes['isExpanded'] || changes['isReadOnly']) {
      this.computeDisplayValues();
    }
  }

  private computeDisplayValues(): void {
    // Compute display name
    this.displayName = this.food?.name || '';

    // Compute serving label
    if (this.food && this.food.components && this.food.components.length > 1) {
      // For multi-component foods, show the food-level quantity and unit
      const quantity = this.currentQuantity || this.food.quantity || 1;
      const unit = this.food.unit || 'servings';
      this.servingLabel = `${quantity} ${unit}`;
    } else {
      this.servingLabel = '';
    }

    // Compute visibility flags
    this.computedShouldShowQuantityInput = this.isExpanded && !this.isReadOnly;
    this.computedShouldShowNormalLabel = !this.isExpanded || this.isReadOnly;

    // Compute macro display
    this.computeMacroDisplay();
  }

  private computeMacroDisplay(): void {
    if (!this.food?.components || this.food.components.length <= 1) {
      this.shouldShowMacros = false;
      this.shouldShowCaloriesOnly = false;
      this.macroSummary = '';
      return;
    }

    // Check if any components are branded
    const hasAnyBrandedComponents = this.food.components.some((component: any) =>
      component.selectedFood?.brand || component.selectedFood?.brandOwner
    );

    // Aggregate macros from all components
    const aggregatedMacros = this.aggregateComponentMacros();

    if (hasAnyBrandedComponents) {
      // Show calories only if any components are branded
      this.shouldShowCaloriesOnly = true;
      this.shouldShowMacros = false;
      if (aggregatedMacros.calories && aggregatedMacros.calories > 0) {
        this.macroSummary = `${Math.round(aggregatedMacros.calories)} cal`;
      } else {
        this.macroSummary = '';
      }
    } else {
      // Show all macros if none are branded
      this.shouldShowCaloriesOnly = false;
      this.shouldShowMacros = true;
      const parts: string[] = [];

      if (aggregatedMacros.calories && aggregatedMacros.calories > 0) {
        parts.push(`${Math.round(aggregatedMacros.calories)} cal`);
      }
      if (aggregatedMacros.protein && aggregatedMacros.protein > 0) {
        parts.push(`${Math.round(aggregatedMacros.protein)}g protein`);
      }
      if (aggregatedMacros.fat && aggregatedMacros.fat > 0) {
        parts.push(`${Math.round(aggregatedMacros.fat)}g fat`);
      }
      if (aggregatedMacros.carbs && aggregatedMacros.carbs > 0) {
        parts.push(`${Math.round(aggregatedMacros.carbs)}g carbs`);
      }

      this.macroSummary = parts.join(', ');
    }
  }

  private aggregateComponentMacros(): { calories: number; protein: number; fat: number; carbs: number } {
    const aggregated = { calories: 0, protein: 0, fat: 0, carbs: 0 };

    if (!this.food?.components) {
      return aggregated;
    }

    for (const component of this.food.components) {
      const selectedFood = component.selectedFood;
      if (!selectedFood?.nutrients) continue;

      const scaledQuantity = component.scaledQuantity || component.quantity || 1;

      // Add scaled nutrients
      if (selectedFood.nutrients.energy_kcal) {
        aggregated.calories += selectedFood.nutrients.energy_kcal * scaledQuantity;
      }
      if (selectedFood.nutrients.protein) {
        aggregated.protein += selectedFood.nutrients.protein * scaledQuantity;
      }
      if (selectedFood.nutrients.total_fat) {
        aggregated.fat += selectedFood.nutrients.total_fat * scaledQuantity;
      }
      if (selectedFood.nutrients.carbohydrate) {
        aggregated.carbs += selectedFood.nutrients.carbohydrate * scaledQuantity;
      }
    }

    return aggregated;
  }

  onToggleExpansion(): void {
    this.toggleExpansion.emit(this.foodIndex);
  }

  onQuantityChange(newQuantity: number): void {
    this.quantityChanged.emit({
      foodIndex: this.foodIndex,
      quantity: newQuantity
    });
  }

  onRemoveFood(): void {
    if (this.food?.id) {
      this.removeFood.emit(this.food.id);
    }
  }

}
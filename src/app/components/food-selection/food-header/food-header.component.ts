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
  @Input() selectedServings: { [componentId: string]: any } = {};

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
    if (changes['food'] || changes['currentQuantity'] || changes['isExpanded'] || changes['isReadOnly'] || changes['selectedServings']) {
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

    // Aggregate macros from all components
    const aggregatedMacros = this.aggregateComponentMacros();

    // Always show full macro information for multi-component foods
    this.shouldShowMacros = true;
    this.shouldShowCaloriesOnly = false;

    const parts: string[] = [];

    if (aggregatedMacros.calories !== null && aggregatedMacros.calories >= 0) {
      parts.push(`${Math.round(aggregatedMacros.calories)} cal`);
    }
    if (aggregatedMacros.protein !== null && aggregatedMacros.protein >= 0) {
      parts.push(`${Math.round(aggregatedMacros.protein)} protein`);
    }
    if (aggregatedMacros.fat !== null && aggregatedMacros.fat >= 0) {
      parts.push(`${Math.round(aggregatedMacros.fat)} fat`);
    }
    if (aggregatedMacros.carbs !== null && aggregatedMacros.carbs >= 0) {
      parts.push(`${Math.round(aggregatedMacros.carbs)} carbs`);
    }

    this.macroSummary = parts.length > 0 ? `(${parts.join(', ')})` : '';
  }

  private aggregateComponentMacros(): { calories: number | null; protein: number | null; fat: number | null; carbs: number | null } {
    const aggregated = { calories: 0, protein: 0, fat: 0, carbs: 0 };
    let hasAnyNutrients = false;

    if (!this.food?.components) {
      return { calories: null, protein: null, fat: null, carbs: null };
    }

    for (const component of this.food.components) {
      // Get the selected serving using the selectedServings input if available
      let selectedServing = null;
      if (component.id && this.selectedServings[component.id]) {
        selectedServing = this.selectedServings[component.id];
      } else {
        // Fallback to the original logic
        const selectedMatch = component.matches?.find((m: any) => m.isBestMatch) || component.matches?.[0];
        if (!selectedMatch) continue;
        selectedServing = selectedMatch.servings?.find((s: any) =>
          s.providerServingId === selectedMatch.selectedServingId
        ) || selectedMatch.servings?.[0];
      }

      if (!selectedServing?.nutrients) continue;

      // The nutrients are already scaled by the parent component, so we can use them directly
      const nutrients = selectedServing.nutrients;

      if (this.getMacro(nutrients, ['calories', 'Calories', 'energy_kcal', 'Energy']) !== null) {
        aggregated.calories += this.getMacro(nutrients, ['calories', 'Calories', 'energy_kcal', 'Energy'])!;
        hasAnyNutrients = true;
      }
      if (this.getMacro(nutrients, ['protein', 'Protein']) !== null) {
        aggregated.protein += this.getMacro(nutrients, ['protein', 'Protein'])!;
        hasAnyNutrients = true;
      }
      if (this.getMacro(nutrients, ['fat', 'Fat', 'total_fat']) !== null) {
        aggregated.fat += this.getMacro(nutrients, ['fat', 'Fat', 'total_fat'])!;
        hasAnyNutrients = true;
      }
      if (this.getMacro(nutrients, ['carbohydrate', 'Carbohydrate', 'carbohydrates', 'carbs']) !== null) {
        aggregated.carbs += this.getMacro(nutrients, ['carbohydrate', 'Carbohydrate', 'carbohydrates', 'carbs'])!;
        hasAnyNutrients = true;
      }
    }

    // Apply food-level quantity multiplier
    const foodQuantity = this.currentQuantity || this.food?.quantity || 1;
    if (hasAnyNutrients) {
      return {
        calories: aggregated.calories * foodQuantity,
        protein: aggregated.protein * foodQuantity,
        fat: aggregated.fat * foodQuantity,
        carbs: aggregated.carbs * foodQuantity
      };
    }

    return { calories: null, protein: null, fat: null, carbs: null };
  }

  private getMacro(nutrients: { [key: string]: number } | undefined, keys: string[]): number | null {
    if (!nutrients) return null;
    for (const key of keys) {
      if (typeof nutrients[key] === 'number') {
        return nutrients[key];
      }
    }
    return null;
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
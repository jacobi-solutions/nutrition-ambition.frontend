import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon, IonGrid, IonRow, IonCol } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { chevronUpOutline, chevronDownOutline, trashOutline } from 'ionicons/icons';
import { ServingQuantityInputComponent } from 'src/app/components/serving-quantity-input.component/serving-quantity-input.component';
import { FoodSelectionService } from 'src/app/services/food-selection.service';

@Component({
  selector: 'app-food-header',
  templateUrl: './food-header.component.html',
  styleUrls: ['./food-header.component.scss'],
  standalone: true,
  imports: [CommonModule, IonIcon, IonGrid, IonRow, IonCol, ServingQuantityInputComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FoodHeaderComponent implements OnInit, OnChanges {
  @Input() food: any = null;
  @Input() foodIndex: number = 0;
  @Input() isReadOnly: boolean = false;
  @Input() isExpanded: boolean = false;

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

  constructor(private foodSelectionService: FoodSelectionService) {
    addIcons({ chevronUpOutline, chevronDownOutline, trashOutline });
  }

  ngOnInit(): void {
    this.computeDisplayValues();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['food'] || changes['isExpanded'] || changes['isReadOnly']) {
      this.computeDisplayValues();
    }
  }

  private computeDisplayValues(): void {
    // Compute display name
    this.displayName = this.food?.name || '';

    // Compute serving label
    if (this.food && this.food.components && this.food.components.length > 1) {
      // For multi-component foods, show the food-level quantity and unit
      const quantity = this.food.quantity || 1;
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
      // Skip removed components
      if (component.isRemoved) continue;

      // Get the selected serving from component data
      const selectedMatch = component.matches?.find((m: any) => m.isBestMatch) || component.matches?.[0];
      if (!selectedMatch) continue;

      const selectedServing = selectedMatch.servings?.find((s: any) =>
        s.providerServingId === selectedMatch.selectedServingId
      ) || selectedMatch.servings?.[0];

      if (!selectedServing?.nutrients) continue;

      // Get current serving quantity from the service
      const currentQuantity = this.foodSelectionService.getServingQuantity(component.id, selectedServing.id || '') || 1;

      // Scale the base nutrients by the current quantity
      const baseNutrients = selectedServing.nutrients;

      const scaledCalories = this.getMacro(baseNutrients, ['calories', 'Calories', 'energy_kcal', 'Energy']);
      if (scaledCalories !== null) {
        aggregated.calories += scaledCalories * currentQuantity;
        hasAnyNutrients = true;
      }

      const scaledProtein = this.getMacro(baseNutrients, ['protein', 'Protein']);
      if (scaledProtein !== null) {
        aggregated.protein += scaledProtein * currentQuantity;
        hasAnyNutrients = true;
      }

      const scaledFat = this.getMacro(baseNutrients, ['fat', 'Fat', 'total_fat']);
      if (scaledFat !== null) {
        aggregated.fat += scaledFat * currentQuantity;
        hasAnyNutrients = true;
      }

      const scaledCarbs = this.getMacro(baseNutrients, ['carbohydrate', 'Carbohydrate', 'carbohydrates', 'carbs']);
      if (scaledCarbs !== null) {
        aggregated.carbs += scaledCarbs * currentQuantity;
        hasAnyNutrients = true;
      }
    }

    // Apply food-level quantity multiplier
    const foodQuantity = this.food?.quantity || 1;
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
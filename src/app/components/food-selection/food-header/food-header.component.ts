import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon, IonGrid, IonRow, IonCol } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { chevronUpOutline, chevronDownOutline, trashOutline } from 'ionicons/icons';
import { ServingQuantityInputComponent } from 'src/app/components/food-selection/serving-quantity-input.component/serving-quantity-input.component';
import { ServingIdentifierUtil, NutrientScalingUtil } from '../food-selection.util';

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
  statusTextDisplay: string = '';
  quantityUnitLabel: string = '';
  computedShouldShowQuantityInput: boolean = false;
  computedShouldShowNormalLabel: boolean = false;
  hasStatusText: boolean = false;
  photoThumb: string = '';
  photoHighRes: string = '';

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
    // Always recompute when any input changes
    this.computeDisplayValues();
  }

  private computeDisplayValues(): void {
    // Compute display name
    this.displayName = this.food?.name || '';

    // Compute photo from first component's selected food
    if (this.food?.components && this.food.components.length > 0) {
      const firstComponent = this.food.components[0];
      const selectedFood = firstComponent?.matches?.find((m: any) => m.isBestMatch) || firstComponent?.matches?.[0];
      this.photoThumb = selectedFood?.photoThumb || '';
      this.photoHighRes = selectedFood?.photoHighRes || '';
    } else {
      this.photoThumb = '';
      this.photoHighRes = '';
    }

    // Compute serving label and status
    if (this.food && this.food.components && this.food.components.length > 1) {
      // For multi-component foods, show the food-level quantity and unit
      const quantity = this.food.quantity || 1;
      const unit = quantity === 1 ? (this.food.singularUnit || 'serving') : (this.food.pluralUnit || 'servings');
      const componentCount = this.food.components.length;

      // Always set serving label (quantity + unit + component count)
      this.servingLabel = `${quantity} ${unit} - ${componentCount} component${componentCount !== 1 ? 's' : ''}`;

      // Use isPending flag directly (bubbled up from backend)
      this.hasStatusText = this.food.isPending || false;

      if (this.food.isPending) {
        // Show status text from backend (e.g., "Calculating components", "Processing 2 of 3 components")
        this.statusTextDisplay = this.food.statusText || 'Processing';
      } else {
        this.statusTextDisplay = '';
      }
    } else {
      this.servingLabel = '';
      this.statusTextDisplay = '';
      this.hasStatusText = false;
    }

    // Compute quantity unit label
    const quantity = this.food?.quantity || 1;
    this.quantityUnitLabel = quantity === 1 ? (this.food?.singularUnit || 'serving') : (this.food?.pluralUnit || 'servings');

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

    // Always show macros for multi-component foods
    this.shouldShowMacros = true;
    this.shouldShowCaloriesOnly = false;

    // Aggregate macros from all components
    const aggregatedMacros = this.aggregateComponentMacros();

    // If no macros available yet (all null), show dummy macros
    const hasAnyMacros = aggregatedMacros.calories !== null ||
                         aggregatedMacros.protein !== null ||
                         aggregatedMacros.fat !== null ||
                         aggregatedMacros.carbs !== null;

    if (!hasAnyMacros) {
      this.macroSummary = "(?? cal, ?? g protein, ?? g fat, ?? g carb)";
      return;
    }

    // Show all four macros consistently (cal, protein, fat, carbs)
    // Use 0 for any macro that's null (nutrient not available in the data)
    const cal = aggregatedMacros.calories !== null ? Math.round(aggregatedMacros.calories) : 0;
    const protein = aggregatedMacros.protein !== null ? Math.round(aggregatedMacros.protein) : 0;
    const fat = aggregatedMacros.fat !== null ? Math.round(aggregatedMacros.fat) : 0;
    const carbs = aggregatedMacros.carbs !== null ? Math.round(aggregatedMacros.carbs) : 0;

    this.macroSummary = `(${cal} cal, ${protein} g protein, ${fat} g fat, ${carbs} g carb)`;
  }

  private aggregateComponentMacros(): { calories: number | null; protein: number | null; fat: number | null; carbs: number | null } {
    const aggregated = { calories: 0, protein: 0, fat: 0, carbs: 0 };
    let hasAnyNutrients = false;

    if (!this.food?.components) {
      return { calories: null, protein: null, fat: null, carbs: null };
    }

    for (const component of this.food.components) {

      // Get the selected serving from component data
      const selectedMatch = component.matches?.find((m: any) => m.isBestMatch) || component.matches?.[0];
      if (!selectedMatch) continue;

      const selectedServing = selectedMatch.servings?.find((s: any) =>
        ServingIdentifierUtil.areEqual(s.servingId, selectedMatch.selectedServingId)
      ) || selectedMatch.servings?.[0];

      if (!selectedServing) continue;

      // Use the utility to get properly scaled nutrients (handles alternative servings)
      const scaledNutrients = NutrientScalingUtil.getScaledNutrients(selectedServing, selectedMatch);
      if (!scaledNutrients) continue;

      const scaledCalories = NutrientScalingUtil.getMacro(scaledNutrients, ['calories', 'Calories', 'energy_kcal', 'Energy']);
      if (scaledCalories !== null) {
        aggregated.calories += scaledCalories;
        hasAnyNutrients = true;
      }

      const scaledProtein = NutrientScalingUtil.getMacro(scaledNutrients, ['protein', 'Protein']);
      if (scaledProtein !== null) {
        aggregated.protein += scaledProtein;
        hasAnyNutrients = true;
      }

      const scaledFat = NutrientScalingUtil.getMacro(scaledNutrients, ['fat', 'Fat', 'total_fat']);
      if (scaledFat !== null) {
        aggregated.fat += scaledFat;
        hasAnyNutrients = true;
      }

      const scaledCarbs = NutrientScalingUtil.getMacro(scaledNutrients, ['carbohydrate', 'Carbohydrate', 'carbohydrates', 'carbs']);
      if (scaledCarbs !== null) {
        aggregated.carbs += scaledCarbs;
        hasAnyNutrients = true;
      }
    }

    // Apply food-level quantity normalization using initialQuantity
    const foodQuantity = this.food?.quantity || 1;
    const initialQuantity = this.food?.initialQuantity;

    if (initialQuantity === undefined || initialQuantity === null) {
      throw new Error(`initialQuantity is required for nutrition calculations but is missing for food: ${this.food?.name || 'unknown'}`);
    }

    if (hasAnyNutrients) {
      // Normalize by dividing by initial quantity, then scale by current quantity
      const scaleFactor = foodQuantity / initialQuantity;
      return {
        calories: aggregated.calories * scaleFactor,
        protein: aggregated.protein * scaleFactor,
        fat: aggregated.fat * scaleFactor,
        carbs: aggregated.carbs * scaleFactor
      };
    }

    return { calories: null, protein: null, fat: null, carbs: null };
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
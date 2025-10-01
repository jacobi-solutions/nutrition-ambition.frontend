import {
  FoodBreakdown,
  ComponentBreakdown,
  FoodEntryBreakdown,
  NutrientBreakdown
} from '../services/nutrition-ambition-api.service';

/**
 * Display model for ComponentBreakdown with precomputed UI state
 */
export class ComponentBreakdownDisplay extends ComponentBreakdown {
  // Precomputed display values
  displayName?: string;
  formattedAmount?: string;
  isSelected?: boolean;

  constructor(data?: ComponentBreakdown) {
    super(data);
    if (data) {
      Object.assign(this, data);
    }
  }

  computeDisplayValues(): void {
    // Precompute display name with brand
    this.displayName = this.brandName
      ? `${this.brandName} - ${this.name}`
      : this.name || '';

    // Precompute formatted amount
    this.formattedAmount = `${this.formatQuantity(this.totalAmount)} ${this.unit}`;
  }

  private formatQuantity(value?: number): string {
    if (!value || value <= 0) return '0';
    return value % 1 === 0 ? value.toString() : value.toFixed(1);
  }
}

/**
 * Display model for FoodBreakdown with precomputed UI state
 */
export class FoodBreakdownDisplay extends FoodBreakdown {
  // Precomputed display values
  displayName?: string;
  servingDisplay?: string;
  isSelected?: boolean;
  showingNutrients?: boolean;  // New state for showing nutrients via info icon
  isMultiComponent?: boolean;
  isSingleComponent?: boolean;

  // Enhanced components with display state
  componentsDisplay?: ComponentBreakdownDisplay[];

  constructor(data?: FoodBreakdown) {
    super(data);
    if (data) {
      Object.assign(this, data);

      // Convert components to display models
      if (data.components) {
        this.componentsDisplay = data.components.map(c => new ComponentBreakdownDisplay(c));
      }
    }
  }

  computeDisplayValues(): void {
    // Precompute food type flags
    this.isMultiComponent = (this.components?.length || 0) > 1;
    this.isSingleComponent = (this.components?.length || 0) === 1;

    // Precompute display name with component count for multi-component foods
    const baseName = this.name || 'Unknown Food';
    if (this.isMultiComponent) {
      const componentCount = this.componentCount || this.components?.length || 0;
      this.displayName = `${baseName} - ${componentCount} components`;
    } else {
      this.displayName = baseName;
    }

    // Precompute serving display
    if (this.isSingleComponent && this.components?.[0]) {
      const component = this.components[0];
      const quantity = this.formatQuantity(component.totalAmount);
      const unit = component.unit || 'serving';
      this.servingDisplay = `${quantity} ${unit}`;
    } else {
      // Use food-level quantity and unit for multi-component foods
      const quantity = this.formatQuantity(this.quantity || 1);
      const unit = this.foodUnit || 'serving';
      this.servingDisplay = `${quantity} ${unit}`;
    }

    // Compute display values for components
    this.componentsDisplay?.forEach(component => {
      component.computeDisplayValues();
    });
  }

  updateSelectionState(selectedFood?: FoodBreakdownDisplay, selectedComponent?: ComponentBreakdownDisplay): void {
    this.isSelected = selectedFood?.foodId === this.foodId;

    // Update component selection states
    this.componentsDisplay?.forEach(component => {
      component.isSelected = selectedComponent?.componentId === component.componentId;
    });
  }

  private formatQuantity(value?: number): string {
    if (!value || value <= 0) return '0';
    return value % 1 === 0 ? value.toString() : value.toFixed(1);
  }
}

/**
 * Display model for FoodEntryBreakdown with precomputed UI state
 */
export class FoodEntryBreakdownDisplay extends FoodEntryBreakdown {
  // Precomputed display values
  hasEditingFood?: boolean;
  hasSelectedFood?: boolean;

  // Enhanced foods with display state
  foodsDisplay?: FoodBreakdownDisplay[];

  constructor(data?: FoodEntryBreakdown) {
    super(data);
    if (data) {
      Object.assign(this, data);

      // Convert foods to display models
      if (data.foods) {
        this.foodsDisplay = data.foods.map(f => new FoodBreakdownDisplay(f));
      }
    }
  }

  computeDisplayValues(): void {
    // Compute display values for all foods
    this.foodsDisplay?.forEach(food => {
      food.computeDisplayValues();
    });
  }

  updateSelectionState(
    selectedFood?: FoodBreakdownDisplay,
    selectedComponent?: ComponentBreakdownDisplay,
    editingFoodKey?: string
  ): void {
    // Check if this entry contains the selected food
    this.hasSelectedFood = this.foodsDisplay?.some(food =>
      food.foodId === selectedFood?.foodId
    ) || false;

    // Check if this entry contains the editing food
    this.hasEditingFood = this.foodsDisplay?.some(food =>
      this.getFoodKey(food) === editingFoodKey
    ) || false;

    // Update selection states for all foods
    this.foodsDisplay?.forEach(food => {
      food.updateSelectionState(selectedFood, selectedComponent);
    });
  }

  private getFoodKey(food: any): string {
    // Create a unique key for the food using the same logic as removal/comparison
    if (food.componentId) return food.componentId;
    if (Array.isArray(food.foodItemIds)) return food.foodItemIds.join(',');
    return food.foodEntryId || food.name || '';
  }
}

/**
 * Display model for NutrientBreakdown with precomputed UI state
 */
export class NutrientBreakdownDisplay extends NutrientBreakdown {
  // Precomputed display values
  isSelected?: boolean;
  formattedAmount?: string;

  constructor(data?: NutrientBreakdown) {
    super(data);
    if (data) {
      Object.assign(this, data);
    }
  }

  computeDisplayValues(): void {
    // Precompute formatted amount
    this.formattedAmount = `${this.formatAmount(this.totalAmount)} ${this.unit}`;
  }

  updateSelectionState(selectedNutrient?: NutrientBreakdownDisplay): void {
    this.isSelected = selectedNutrient?.nutrientKey === this.nutrientKey;
  }

  private formatAmount(value?: number): string {
    if (!value || value <= 0) return '0';
    return value % 1 === 0 ? value.toString() : value.toFixed(1);
  }
}
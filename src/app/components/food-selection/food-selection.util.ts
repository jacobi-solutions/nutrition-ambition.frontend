import { ServingIdentifier, ComponentServing, ComponentMatch } from '../../services/nutrition-ambition-api.service';

export class ServingIdentifierUtil {

  static areEqual(a: ServingIdentifier | null | undefined, b: ServingIdentifier | null | undefined): boolean {
    if (a == null && b == null) return true;
    if (a == null || b == null) return false;
    return a.provider === b.provider &&
           a.foodType === b.foodType &&
           a.foodName === b.foodName &&
           a.variantIndex === b.variantIndex &&
           a.servingType === b.servingType;
  }

  static isEmpty(servingId: ServingIdentifier | null | undefined): boolean {
    return servingId == null ||
           !servingId.provider ||
           !servingId.foodType ||
           !servingId.foodName ||
           !servingId.servingType;
  }

  static toUniqueString(servingId: ServingIdentifier | null | undefined): string {
    if (!servingId) return '';
    return `${servingId.provider}-${servingId.foodType}-${servingId.foodName}-${servingId.variantIndex}-${servingId.servingType}`;
  }
}

export class NutrientScalingUtil {

  /**
   * Gets properly scaled nutrients for a serving, handling both direct nutrient data and
   * fallback scaling from base serving for alternative servings.
   */
  static getScaledNutrients(serving: ComponentServing, selectedFood: ComponentMatch | null): { [key: string]: number } | null {
    // Get the effective quantity from the serving, fallback to baseQuantity
    const effectiveQuantity = (serving as any).effectiveQuantity;
    const currentQuantity = effectiveQuantity !== undefined && effectiveQuantity !== null
      ? effectiveQuantity
      : serving.baseQuantity || 1;

    // If serving has nutrient data, scale it by current quantity
    if (serving.nutrients && this.hasNutrientData(serving.nutrients)) {
      const scaledNutrients: { [key: string]: number } = {};
      for (const [key, value] of Object.entries(serving.nutrients)) {
        scaledNutrients[key] = value * currentQuantity;
      }
      return scaledNutrients;
    }

    // Alternative serving has no nutrients - scale from base serving
    if (!selectedFood?.servings) return null;

    // Find the default serving (indicated by servingType === 'default')
    // This is the base serving with full nutrient data
    let baseServing = selectedFood.servings.find(s =>
      s.servingId?.servingType === 'default' &&
      s.nutrients &&
      this.hasNutrientData(s.nutrients)
    );

    // Fallback: if no default serving found, use the first serving with nutrients
    if (!baseServing?.nutrients) {
      baseServing = selectedFood.servings.find(s =>
        s.nutrients &&
        this.hasNutrientData(s.nutrients)
      );
    }

    if (!baseServing?.nutrients) return null;

    // Calculate scale factor: altWeight / baseWeight
    const baseWeight = baseServing.metricServingAmount;
    const altWeight = serving.metricServingAmount;

    if (!baseWeight || !altWeight || baseWeight <= 0) return null;

    const weightScaleFactor = altWeight / baseWeight;
    const totalScaleFactor = weightScaleFactor * currentQuantity;

    // Scale only the 4 preview nutrients for food selection
    const scaledNutrients: { [key: string]: number } = {};
    const previewNutrients = ['calories', 'protein', 'fat', 'carbohydrate'];

    for (const nutrientKey of previewNutrients) {
      if (typeof baseServing.nutrients[nutrientKey] === 'number') {
        scaledNutrients[nutrientKey] = baseServing.nutrients[nutrientKey] * totalScaleFactor;
      }
    }

    return scaledNutrients;
  }

  /**
   * Helper to check if nutrients object has meaningful nutrient data (not just metadata)
   */
  static hasNutrientData(nutrients: { [key: string]: number }): boolean {
    if (!nutrients) return false;

    // Count keys that are actual nutrients (not metadata like _source, _id, etc.)
    const nutrientKeys = Object.keys(nutrients).filter(key =>
      !key.startsWith('_') && // Exclude metadata fields starting with underscore
      typeof nutrients[key] === 'number' && // Must be numeric
      nutrients[key] >= 0 // Must be non-negative
    );

    // Need at least 3 nutrients to consider it meaningful data
    return nutrientKeys.length > 3;
  }

  /**
   * Helper to get a macro value from nutrients object, checking multiple possible keys
   */
  static getMacro(nutrients: { [key: string]: number } | undefined, keys: string[]): number | null {
    if (!nutrients) return null;
    for (const key of keys) {
      if (typeof nutrients[key] === 'number') {
        return nutrients[key];
      }
    }
    return null;
  }
}
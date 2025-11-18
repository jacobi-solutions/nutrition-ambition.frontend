import { ServingIdentifier, ComponentServing, ComponentMatch } from '../../services/nutrition-ambition-api.service';
import { ComponentServingDisplay } from '../../models/food-selection-display';

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
  static getScaledNutrients(serving: ComponentServingDisplay, selectedFood: ComponentMatch | null): { [key: string]: number } | null {
    console.log('[NUTRIENT_SCALING] Starting calculation for component:', selectedFood?.displayName || 'unknown');
    console.log('  - Serving description:', serving?.description);

    if (!serving) {
      console.log('  - ERROR: No serving provided');
      return null;
    }

    // Log all the input values
    const effectiveQuantity = serving.effectiveQuantity;
    const baseQuantity = serving.baseQuantity || 1;
    const aiNumerator = serving.aiRecommendedScaleNumerator || 1;
    const aiDenominator = serving.aiRecommendedScaleDenominator || 1;
    const userConfirmedQty = serving.userConfirmedQuantity;

    console.log('  - Input values:');
    console.log('    - baseQuantity:', baseQuantity);
    console.log('    - effectiveQuantity:', effectiveQuantity);
    console.log('    - userConfirmedQuantity:', userConfirmedQty);
    console.log('    - aiRecommendedScale:', `${aiNumerator}/${aiDenominator} = ${aiNumerator/aiDenominator}`);

    // Get the effective quantity from the ComponentServingDisplay object
    const currentQuantity = serving.effectiveQuantity || ((serving.baseQuantity || 1) * (serving.aiRecommendedScaleNumerator || 1) / (serving.aiRecommendedScaleDenominator || 1)) || 1;

    console.log('  - Calculated currentQuantity:', currentQuantity);
    console.log('    - Formula used:', effectiveQuantity ? 'effectiveQuantity' : 'baseQuantity * aiScale');

    // All servings now have nutrient data from backend
    if (serving.nutrients && this.hasNutrientData(serving.nutrients)) {
      // Calculate unit scale factor: nutrients are for baseQuantity, so convert to per-unit
      const unitScaleFactor = 1 / (serving.baseQuantity || 1);
      console.log('  - Unit scale factor:', unitScaleFactor, `(1 / ${serving.baseQuantity || 1})`);

      const scaledNutrients: { [key: string]: number } = {};

      // Log key nutrients before and after scaling
      const keyNutrients = ['calories', 'protein', 'fat', 'carbohydrate', 'fiber', 'sugar'];
      console.log('  - Raw nutrients (key values):');
      for (const key of keyNutrients) {
        if (serving.nutrients[key] !== undefined) {
          console.log(`    - ${key}: ${serving.nutrients[key]}`);
        }
      }

      for (const [key, value] of Object.entries(serving.nutrients)) {
        const scaledValue = value * unitScaleFactor * currentQuantity;
        scaledNutrients[key] = scaledValue;

        // Log scaling calculation for key nutrients
        if (keyNutrients.includes(key)) {
          console.log(`  - Scaling ${key}: ${value} * ${unitScaleFactor} * ${currentQuantity} = ${scaledValue}`);
        }
      }

      console.log('  - Final scaled nutrients:', {
        calories: scaledNutrients['calories'],
        protein: scaledNutrients['protein'],
        fat: scaledNutrients['fat'],
        carbohydrate: scaledNutrients['carbohydrate']
      });

      return scaledNutrients;
    }

    console.log('  - ERROR: No valid nutrient data found');
    return null;
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

    // Need at least 1 nutrient to consider it meaningful data (changed from > 3 to >= 1)
    return nutrientKeys.length >= 1;
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
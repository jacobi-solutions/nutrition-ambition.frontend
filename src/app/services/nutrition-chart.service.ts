import { Injectable } from '@angular/core';
import { NutrientBreakdown } from './nutrition-ambition-api.service';

export interface ChartData {
  name: string;
  value: number;
  extra?: any;
}

export interface MacroChartData {
  calories: number;
  caloriesTarget?: number;
  macroDistribution: ChartData[]; // For pie/doughnut chart
  macroAmounts: {
    protein: { amount: number; target?: number; percentage?: number };
    fat: { amount: number; target?: number; percentage?: number };
    carbs: { amount: number; target?: number; percentage?: number };
  };
}

export interface NutrientCategoryData {
  category: string;
  nutrients: NutrientBreakdown[];
  chartData?: ChartData[];
  displayType?: 'bar' | 'pie' | 'gauge' | 'number-card' | 'progress';
}

@Injectable({
  providedIn: 'root'
})
export class NutritionChartService {

  // Theme colors from variables.scss
  private readonly colors = {
    primary: '#D64933',    // Tomato
    secondary: '#4E6E5D',  // Olive
    tertiary: '#FF8A5C',   // Salmon
    success: '#A9C8B2',    // Sage
    warning: '#FFB347',    // Peach (for warnings)
    danger: '#E74C3C',     // Red (for over limits)
    medium: '#A3A3A3',     // Smoke
    light: '#F5F3EF',      // Bone
    dark: '#2E2E2E',       // Charcoal
    // Chart-specific colors
    protein: '#4E6E5D',    // Olive (secondary)
    fat: '#FF8A5C',        // Salmon (tertiary)
    carbs: '#D64933',      // Tomato (primary)
    fiber: '#A9C8B2',      // Sage
    sodium: '#FFB347',     // Warning color for sodium
    potassium: '#4E6E5D',  // Olive for potassium
    saturated: '#E74C3C',  // Danger for saturated fat
    mono: '#A9C8B2',       // Sage for mono
    poly: '#4E6E5D',       // Olive for poly
    trans: '#2E2E2E'       // Dark for trans fat
  };

  constructor() { }

  /**
   * Categorize nutrients based on their category field
   * Future-proof: Will work with user-customized categories from DB
   */
  categorizeNutrients(nutrients: NutrientBreakdown[]): Map<string, NutrientBreakdown[]> {
    const categoryMap = new Map<string, NutrientBreakdown[]>();

    nutrients.forEach(nutrient => {
      // Use the category from backend (will be user-customizable in future)
      // For now, fallback to determining category if not set
      const category = this.getNutrientCategory(nutrient);

      if (!categoryMap.has(category)) {
        categoryMap.set(category, []);
      }
      categoryMap.get(category)!.push(nutrient);
    });

    return categoryMap;
  }

  /**
   * Get category for a nutrient - uses backend category or fallback logic
   */
  private getNutrientCategory(nutrient: NutrientBreakdown): string {
    // In the future, this will come from the backend with user preferences
    // For now, use the nutrientKey to determine category as fallback
    const key = nutrient.nutrientKey?.toLowerCase() || '';

    // Check if backend already provides category (after NSwag regeneration)
    if ((nutrient as any).category) {
      return (nutrient as any).category;
    }

    // Fallback categorization
    if (['calories', 'protein', 'fat', 'carbohydrate'].includes(key)) {
      return 'Macronutrients';
    } else if (['sodium', 'potassium', 'calcium', 'magnesium', 'chloride'].includes(key)) {
      return 'Electrolytes';
    } else if (key.includes('vitamin') || ['thiamin', 'riboflavin', 'niacin', 'folate', 'biotin', 'pantothenic_acid'].includes(key)) {
      return 'Vitamins';
    } else if (['iron', 'zinc', 'selenium', 'copper', 'manganese', 'phosphorus', 'iodine', 'chromium', 'molybdenum', 'fluoride'].includes(key)) {
      return 'Minerals';
    } else if (key.includes('fat') || key === 'ala' || key === 'epa' || key === 'dha') {
      return 'HealthyFats';
    } else {
      return 'Other';
    }
  }

  /**
   * Prepare macronutrient data for charts
   */
  getMacroChartData(nutrients: NutrientBreakdown[]): MacroChartData {
    const calories = nutrients.find(n => n.nutrientKey?.toLowerCase() === 'calories');
    const protein = nutrients.find(n => n.nutrientKey?.toLowerCase() === 'protein');
    const fat = nutrients.find(n => n.nutrientKey?.toLowerCase() === 'fat');
    const carbs = nutrients.find(n => n.nutrientKey?.toLowerCase() === 'carbohydrate');

    // Calculate calories from macros for distribution
    const proteinCals = (protein?.totalAmount || 0) * 4;
    const fatCals = (fat?.totalAmount || 0) * 9;
    const carbCals = (carbs?.totalAmount || 0) * 4;
    const totalMacroCals = proteinCals + fatCals + carbCals;

    // Calculate percentages
    const proteinPercent = totalMacroCals > 0 ? (proteinCals / totalMacroCals) * 100 : 0;
    const fatPercent = totalMacroCals > 0 ? (fatCals / totalMacroCals) * 100 : 0;
    const carbPercent = totalMacroCals > 0 ? (carbCals / totalMacroCals) * 100 : 0;

    return {
      calories: calories?.totalAmount || 0,
      caloriesTarget: calories?.maxTarget || calories?.minTarget,
      macroDistribution: [
        { name: 'Protein', value: Math.round(proteinPercent), extra: { color: this.colors.protein } },
        { name: 'Fat', value: Math.round(fatPercent), extra: { color: this.colors.fat } },
        { name: 'Carbs', value: Math.round(carbPercent), extra: { color: this.colors.carbs } }
      ],
      macroAmounts: {
        protein: {
          amount: protein?.totalAmount || 0,
          target: protein?.maxTarget || protein?.minTarget,
          percentage: proteinPercent
        },
        fat: {
          amount: fat?.totalAmount || 0,
          target: fat?.maxTarget || fat?.minTarget,
          percentage: fatPercent
        },
        carbs: {
          amount: carbs?.totalAmount || 0,
          target: carbs?.maxTarget || carbs?.minTarget,
          percentage: carbPercent
        }
      }
    };
  }

  /**
   * Get color based on nutrient performance vs target
   */
  getNutrientStatusColor(nutrient: NutrientBreakdown): string {
    const amount = nutrient.totalAmount || 0;
    const min = nutrient.minTarget;
    const max = nutrient.maxTarget;

    if (min !== undefined && amount < min * 0.8) {
      return this.colors.warning; // Below minimum
    } else if (max !== undefined && amount > max * 1.2) {
      return this.colors.danger; // Above maximum
    } else {
      return this.colors.success; // Within range
    }
  }

  /**
   * Format data for ngx-charts components
   */
  formatForNgxCharts(nutrients: NutrientBreakdown[], chartType: 'bar' | 'pie' | 'gauge'): ChartData[] {
    return nutrients.map(n => ({
      name: n.nutrientName || n.nutrientKey || '',
      value: n.totalAmount || 0,
      extra: {
        unit: n.unit,
        target: n.maxTarget || n.minTarget,
        color: this.getNutrientStatusColor(n)
      }
    }));
  }

  /**
   * Calculate percentage of target achieved
   */
  getTargetPercentage(nutrient: NutrientBreakdown): number {
    const amount = nutrient.totalAmount || 0;
    const target = nutrient.maxTarget || nutrient.minTarget;

    if (!target || target === 0) return 0;

    const percentage = (amount / target) * 100;
    return Math.min(Math.round(percentage), 999); // Cap at 999% for display
  }

  /**
   * Get chart color scheme for a category
   */
  getCategoryColorScheme(category: string): any {
    // Return ngx-charts color scheme based on category
    switch (category) {
      case 'Macronutrients':
        return {
          domain: [this.colors.protein, this.colors.fat, this.colors.carbs, this.colors.primary]
        };
      case 'Electrolytes':
        return {
          domain: [this.colors.sodium, this.colors.potassium, this.colors.secondary, this.colors.tertiary, this.colors.success]
        };
      case 'HealthyFats':
        return {
          domain: [this.colors.saturated, this.colors.mono, this.colors.poly, this.colors.trans]
        };
      default:
        return {
          domain: [this.colors.primary, this.colors.secondary, this.colors.tertiary, this.colors.success]
        };
    }
  }
}
import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonGrid, IonRow, IonCol } from '@ionic/angular/standalone';
import { NutrientBreakdown } from '../../services/nutrition-ambition-api.service';
import { NutritionChartService } from '../../services/nutrition-chart.service';

@Component({
  selector: 'app-macronutrients-chart',
  templateUrl: './macronutrients-chart.component.html',
  styleUrls: ['./macronutrients-chart.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonGrid,
    IonRow,
    IonCol
  ]
})
export class MacronutrientsChartComponent implements OnChanges {
  @Input() nutrients: NutrientBreakdown[] = [];

  hasData = false;

  // Display values
  calories = 0;
  caloriesTarget = 0;
  caloriesPercentage = 0;
  targetPercentage = 0;
  proteinPercentage = 0;
  proteinGrams = 0;
  proteinLabelX = 50;
  proteinLabelY = 50;
  fatPercentage = 0;
  fatGrams = 0;
  fatLabelX = 50;
  fatLabelY = 50;
  carbsPercentage = 0;
  carbsGrams = 0;
  carbsLabelX = 50;
  carbsLabelY = 50;

  constructor(private chartService: NutritionChartService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['nutrients'] && this.nutrients?.length > 0) {
      this.computeDisplayValues();
    }
  }

  private computeDisplayValues(): void {
    // Get macro chart data from service
    const macroData = this.chartService.getMacroChartData(this.nutrients);

    if (!macroData) {
      this.hasData = false;
      return;
    }

    this.hasData = true;

    // Round values to 1 decimal and store for display
    this.calories = Math.round((macroData.calories || 0) * 10) / 10;
    this.caloriesTarget = macroData.caloriesTarget ? Math.round(macroData.caloriesTarget * 10) / 10 : 0;

    // Calculate bar heights as percentages (relative to the max value)
    const maxCalories = Math.max(this.calories, this.caloriesTarget, 100); // At least 100 for scale
    this.caloriesPercentage = Math.max((this.calories / maxCalories) * 100, 15); // Minimum 15% height
    this.targetPercentage = this.caloriesTarget > 0 ? (this.caloriesTarget / maxCalories) * 100 : 0;

    // Macro percentages and gram amounts
    this.proteinPercentage = Math.round(macroData.macroAmounts.protein.percentage || 0);
    this.proteinGrams = Math.round((macroData.macroAmounts.protein.amount || 0) * 10) / 10;

    this.fatPercentage = Math.round(macroData.macroAmounts.fat.percentage || 0);
    this.fatGrams = Math.round((macroData.macroAmounts.fat.amount || 0) * 10) / 10;

    this.carbsPercentage = Math.round(macroData.macroAmounts.carbs.percentage || 0);
    this.carbsGrams = Math.round((macroData.macroAmounts.carbs.amount || 0) * 10) / 10;

    // Calculate label positions at the midpoint of each segment
    // The donut has radius 30 with stroke-width 20
    // SVG circles start at 3 o'clock (0 degrees), but we rotate -90deg so they start at 12 o'clock (top)
    const labelRadius = 30; // Middle of the donut ring

    // Protein: starts at top (0 degrees after rotation), midpoint is half of its arc
    const proteinMidAngle = (this.proteinPercentage / 2) * 3.6 - 90; // -90 to account for SVG rotation
    this.proteinLabelX = 50 + labelRadius * Math.cos((proteinMidAngle * Math.PI) / 180);
    this.proteinLabelY = 50 + labelRadius * Math.sin((proteinMidAngle * Math.PI) / 180);

    // Fat: starts after protein, midpoint is protein + half of fat
    const fatMidAngle = (this.proteinPercentage + this.fatPercentage / 2) * 3.6 - 90;
    this.fatLabelX = 50 + labelRadius * Math.cos((fatMidAngle * Math.PI) / 180);
    this.fatLabelY = 50 + labelRadius * Math.sin((fatMidAngle * Math.PI) / 180);

    // Carbs: starts after protein + fat, midpoint is protein + fat + half of carbs
    const carbsMidAngle = (this.proteinPercentage + this.fatPercentage + this.carbsPercentage / 2) * 3.6 - 90;
    this.carbsLabelX = 50 + labelRadius * Math.cos((carbsMidAngle * Math.PI) / 180);
    this.carbsLabelY = 50 + labelRadius * Math.sin((carbsMidAngle * Math.PI) / 180);
  }
}

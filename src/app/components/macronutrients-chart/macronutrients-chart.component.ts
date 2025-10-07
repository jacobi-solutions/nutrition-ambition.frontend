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
  caloriesTargetGhostPercentage = 0;
  proteinPercentage = 0;
  proteinGrams = 0;
  proteinTargetGrams = 0;
  proteinLabelX = 50;
  proteinLabelY = 50;
  proteinLabelRotation = 0;
  proteinTargetPercentage = 0;
  proteinTargetLabelX = 50;
  proteinTargetLabelY = 50;
  proteinTargetLabelRotation = 0;
  fatPercentage = 0;
  fatGrams = 0;
  fatTargetGrams = 0;
  fatLabelX = 50;
  fatLabelY = 50;
  fatLabelRotation = 0;
  fatTargetPercentage = 0;
  fatTargetLabelX = 50;
  fatTargetLabelY = 50;
  fatTargetLabelRotation = 0;
  carbsPercentage = 0;
  carbsGrams = 0;
  carbsTargetGrams = 0;
  carbsLabelX = 50;
  carbsLabelY = 50;
  carbsLabelRotation = 0;
  carbsTargetPercentage = 0;
  carbsTargetLabelX = 50;
  carbsTargetLabelY = 50;
  carbsTargetLabelRotation = 0;
  targetHeaderLabelX = 50;
  targetHeaderLabelY = 50;
  targetHeaderLabelRotation = 0;

  // Scale factor for donut chart (adjust this to resize the entire chart)
  donutScale = 1.2;

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

    // Calculate bar heights as percentages (relative to target)
    this.caloriesPercentage = this.caloriesTarget > 0 ? Math.max((this.calories / this.caloriesTarget) * 100, 5) : 15; // Minimum 5% height

    // Macro percentages and gram amounts
    this.proteinPercentage = Math.round(macroData.macroAmounts.protein.percentage || 0);
    this.proteinGrams = Math.round((macroData.macroAmounts.protein.amount || 0) * 10) / 10;

    this.fatPercentage = Math.round(macroData.macroAmounts.fat.percentage || 0);
    this.fatGrams = Math.round((macroData.macroAmounts.fat.amount || 0) * 10) / 10;

    this.carbsPercentage = Math.round(macroData.macroAmounts.carbs.percentage || 0);
    this.carbsGrams = Math.round((macroData.macroAmounts.carbs.amount || 0) * 10) / 10;

    // Calculate target percentages and grams from real targets
    const proteinTargetCals = (macroData.macroAmounts.protein.target || 0) * 4;
    const fatTargetCals = (macroData.macroAmounts.fat.target || 0) * 9;
    const carbsTargetCals = (macroData.macroAmounts.carbs.target || 0) * 4;
    const totalTargetCals = proteinTargetCals + fatTargetCals + carbsTargetCals;

    if (totalTargetCals > 0) {
      this.proteinTargetPercentage = Math.round((proteinTargetCals / totalTargetCals) * 100);
      this.fatTargetPercentage = Math.round((fatTargetCals / totalTargetCals) * 100);
      this.carbsTargetPercentage = Math.round((carbsTargetCals / totalTargetCals) * 100);

      // Calculate target grams
      this.proteinTargetGrams = Math.round((macroData.macroAmounts.protein.target || 0) * 10) / 10;
      this.fatTargetGrams = Math.round((macroData.macroAmounts.fat.target || 0) * 10) / 10;
      this.carbsTargetGrams = Math.round((macroData.macroAmounts.carbs.target || 0) * 10) / 10;
    }

    // Calculate label positions at the midpoint of each segment
    // The donut has radius 30 with stroke-width 20
    // SVG circles start at 3 o'clock (0 degrees), but we rotate -90deg so they start at 12 o'clock (top)
    const labelRadius = 28; // Slightly inside the middle of the ring for better centering
    const targetLabelRadius = 52; // Outside of the outer ring

    // ALGORITHM EXPLANATION:
    // 1. The SVG is rotated -90deg, so segments start at 12 o'clock (top) instead of 3 o'clock (right)
    // 2. Each segment takes up a percentage of the 360-degree circle
    // 3. To find the midpoint angle: (startPercentage + segmentPercentage/2) * 3.6 - 90
    //    - Multiply by 3.6 because 100% = 360 degrees (360/100 = 3.6)
    //    - Subtract 90 to account for the SVG rotation
    // 4. Position the label at radius distance from center using cos/sin
    // 5. Rotate the text by (angle + 90) so it's perpendicular to the radius (reads outward)

    // Protein: starts at 0%, midpoint is at proteinPercentage/2
    const proteinMidPercent = this.proteinPercentage / 2;
    const proteinMidAngle = proteinMidPercent * 3.6; // Try WITHOUT the -90 adjustment
    this.proteinLabelX = 50 + labelRadius * Math.cos((proteinMidAngle * Math.PI) / 180);
    this.proteinLabelY = 50 + labelRadius * Math.sin((proteinMidAngle * Math.PI) / 180);
    this.proteinLabelRotation = proteinMidPercent * 3.6 + 90;

    const proteinTargetMidPercent = this.proteinTargetPercentage / 2;
    const proteinTargetMidAngle = proteinTargetMidPercent * 3.6;
    this.proteinTargetLabelX = 50 + targetLabelRadius * Math.cos((proteinTargetMidAngle * Math.PI) / 180);
    this.proteinTargetLabelY = 50 + targetLabelRadius * Math.sin((proteinTargetMidAngle * Math.PI) / 180);
    this.proteinTargetLabelRotation = proteinTargetMidPercent * 3.6 + 90;

    // Fat: starts after protein, midpoint is at protein + fat/2
    const fatMidPercent = this.proteinPercentage + this.fatPercentage / 2;
    const fatMidAngle = fatMidPercent * 3.6;
    this.fatLabelX = 50 + labelRadius * Math.cos((fatMidAngle * Math.PI) / 180);
    this.fatLabelY = 50 + labelRadius * Math.sin((fatMidAngle * Math.PI) / 180);
    this.fatLabelRotation = fatMidPercent * 3.6 + 90;

    const fatTargetMidPercent = this.proteinTargetPercentage + this.fatTargetPercentage / 2;
    const fatTargetMidAngle = fatTargetMidPercent * 3.6;
    this.fatTargetLabelX = 50 + targetLabelRadius * Math.cos((fatTargetMidAngle * Math.PI) / 180);
    this.fatTargetLabelY = 50 + targetLabelRadius * Math.sin((fatTargetMidAngle * Math.PI) / 180);
    this.fatTargetLabelRotation = fatTargetMidPercent * 3.6 + 90;

    // Carbs: starts after protein+fat, midpoint is at protein + fat + carbs/2
    const carbsMidPercent = this.proteinPercentage + this.fatPercentage + this.carbsPercentage / 2;
    const carbsMidAngle = carbsMidPercent * 3.6;
    this.carbsLabelX = 50 + labelRadius * Math.cos((carbsMidAngle * Math.PI) / 180);
    this.carbsLabelY = 50 + labelRadius * Math.sin((carbsMidAngle * Math.PI) / 180);
    this.carbsLabelRotation = carbsMidPercent * 3.6 + 90;

    const carbsTargetMidPercent = this.proteinTargetPercentage + this.fatTargetPercentage + this.carbsTargetPercentage / 2;
    const carbsTargetMidAngle = carbsTargetMidPercent * 3.6;
    this.carbsTargetLabelX = 50 + targetLabelRadius * Math.cos((carbsTargetMidAngle * Math.PI) / 180);
    this.carbsTargetLabelY = 50 + targetLabelRadius * Math.sin((carbsTargetMidAngle * Math.PI) / 180);
    this.carbsTargetLabelRotation = carbsTargetMidPercent * 3.6 + 90;

    // Position "Target %" label between carbs end and protein start (top of circle)
    // The gap is between 100% (end of carbs) and 0% (start of protein), which wraps around at top
    // Since we want it at the top, use 0 degrees (top of rotated circle)
    const targetHeaderAngle = 0; // Top of the circle in our rotated coordinate system
    this.targetHeaderLabelX = 50 + targetLabelRadius * Math.cos((targetHeaderAngle * Math.PI) / 180);
    this.targetHeaderLabelY = 50 + targetLabelRadius * Math.sin((targetHeaderAngle * Math.PI) / 180);
    this.targetHeaderLabelRotation = targetHeaderAngle + 90; // Perpendicular to radius
  }
}

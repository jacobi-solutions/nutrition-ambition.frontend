import { Component, Input, OnChanges, SimpleChanges, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonGrid, IonRow, IonCol, IonIcon } from '@ionic/angular/standalone';
import { NutrientBreakdown } from 'src/app/services/nutrition-ambition-api.service';
import { addIcons } from 'ionicons';
import { nutritionOutline } from 'ionicons/icons';

@Component({
  selector: 'app-fats-chart',
  templateUrl: './fats-chart.component.html',
  styleUrls: ['./fats-chart.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonGrid,
    IonRow,
    IonCol,
    IonIcon
  ]
})
export class FatsChartComponent implements OnChanges, AfterViewInit, OnDestroy {
  @Input() nutrients: NutrientBreakdown[] = [];

  hasData = false;
  hasTargets = false;
  isVisible = false;
  private observer: IntersectionObserver | null = null;

  // Display values
  totalFat = 0;
  totalFatTarget = 0;
  totalFatPercentage = 0;
  transPercentage = 0;
  transGrams = 0;
  transTargetGrams = 0;
  transLabelX = 50;
  transLabelY = 50;
  transLabelRotation = 0;
  transTargetPercentage = 0;
  transTargetLabelX = 50;
  transTargetLabelY = 50;
  transTargetLabelRotation = 0;
  saturatedPercentage = 0;
  saturatedGrams = 0;
  saturatedTargetGrams = 0;
  saturatedLabelX = 50;
  saturatedLabelY = 50;
  saturatedLabelRotation = 0;
  saturatedTargetPercentage = 0;
  saturatedTargetLabelX = 50;
  saturatedTargetLabelY = 50;
  saturatedTargetLabelRotation = 0;
  polyPercentage = 0;
  polyGrams = 0;
  polyTargetGrams = 0;
  polyLabelX = 50;
  polyLabelY = 50;
  polyLabelRotation = 0;
  polyTargetPercentage = 0;
  polyTargetLabelX = 50;
  polyTargetLabelY = 50;
  polyTargetLabelRotation = 0;
  monoPercentage = 0;
  monoGrams = 0;
  monoTargetGrams = 0;
  monoLabelX = 50;
  monoLabelY = 50;
  monoLabelRotation = 0;
  monoTargetPercentage = 0;
  monoTargetLabelX = 50;
  monoTargetLabelY = 50;
  monoTargetLabelRotation = 0;

  // Scale factor for donut chart
  donutScale = 1.2;

  constructor(private elementRef: ElementRef) {
    addIcons({ nutritionOutline });
  }

  ngAfterViewInit(): void {
    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !this.isVisible) {
          this.isVisible = true;
        }
      });
    }, {
      threshold: 0,
      rootMargin: '-50% 0px -50% 0px'
    });

    this.observer.observe(this.elementRef.nativeElement);
  }

  ngOnDestroy(): void {
    if (this.observer) {
      this.observer.disconnect();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['nutrients'] && this.nutrients?.length > 0) {
      this.computeDisplayValues();
    }
  }

  private computeDisplayValues(): void {
    // Get fat nutrients (trans fat only for display in value list, not in donut)
    const totalFatNutrient = this.nutrients.find(n =>
      n.nutrientKey?.toLowerCase() === 'total_fat' ||
      n.nutrientKey?.toLowerCase() === 'fat'
    );
    const transNutrient = this.nutrients.find(n => n.nutrientKey?.toLowerCase() === 'trans_fat');
    const saturatedNutrient = this.nutrients.find(n => n.nutrientKey?.toLowerCase() === 'saturated_fat');
    const polyNutrient = this.nutrients.find(n => n.nutrientKey?.toLowerCase() === 'polyunsaturated_fat');
    const monoNutrient = this.nutrients.find(n => n.nutrientKey?.toLowerCase() === 'monounsaturated_fat');

    if (!totalFatNutrient) {
      this.hasData = false;
      return;
    }

    // Total fat bar
    this.totalFat = Math.round((totalFatNutrient.totalAmount || 0) * 10) / 10;

    // Check if we have any actual consumption data
    this.hasData = this.totalFat > 0;

    if (!this.hasData) {
      return;
    }

    // Check if any fat nutrients have targets
    this.hasTargets = !!(
      (totalFatNutrient.maxTarget !== undefined && totalFatNutrient.maxTarget !== null) ||
      (totalFatNutrient.minTarget !== undefined && totalFatNutrient.minTarget !== null) ||
      (transNutrient?.maxTarget !== undefined && transNutrient?.maxTarget !== null) ||
      (transNutrient?.minTarget !== undefined && transNutrient?.minTarget !== null) ||
      (saturatedNutrient?.maxTarget !== undefined && saturatedNutrient?.maxTarget !== null) ||
      (saturatedNutrient?.minTarget !== undefined && saturatedNutrient?.minTarget !== null) ||
      (polyNutrient?.maxTarget !== undefined && polyNutrient?.maxTarget !== null) ||
      (polyNutrient?.minTarget !== undefined && polyNutrient?.minTarget !== null) ||
      (monoNutrient?.maxTarget !== undefined && monoNutrient?.maxTarget !== null) ||
      (monoNutrient?.minTarget !== undefined && monoNutrient?.minTarget !== null)
    );

    // Total fat target
    this.totalFatTarget = Math.round((totalFatNutrient.maxTarget || totalFatNutrient.minTarget || 0) * 10) / 10;
    this.totalFatPercentage = this.totalFatTarget > 0 ? Math.max((this.totalFat / this.totalFatTarget) * 100, 5) : 15;

    // Get grams for each fat type (trans fat only for display, not in donut calculations)
    this.transGrams = Math.round((transNutrient?.totalAmount || 0) * 10) / 10;
    this.saturatedGrams = Math.round((saturatedNutrient?.totalAmount || 0) * 10) / 10;
    this.polyGrams = Math.round((polyNutrient?.totalAmount || 0) * 10) / 10;
    this.monoGrams = Math.round((monoNutrient?.totalAmount || 0) * 10) / 10;

    // Get target grams for each fat type (trans fat only for display, not in donut calculations)
    this.transTargetGrams = Math.round((transNutrient?.maxTarget || transNutrient?.minTarget || 0) * 10) / 10;
    this.saturatedTargetGrams = Math.round((saturatedNutrient?.maxTarget || saturatedNutrient?.minTarget || 0) * 10) / 10;
    this.polyTargetGrams = Math.round((polyNutrient?.maxTarget || polyNutrient?.minTarget || 0) * 10) / 10;
    this.monoTargetGrams = Math.round((monoNutrient?.maxTarget || monoNutrient?.minTarget || 0) * 10) / 10;

    // Calculate percentages for donut (actual consumption) - only 3 fats
    const totalGrams = this.saturatedGrams + this.polyGrams + this.monoGrams;
    if (totalGrams > 0) {
      this.saturatedPercentage = Math.round((this.saturatedGrams / totalGrams) * 100);
      this.polyPercentage = Math.round((this.polyGrams / totalGrams) * 100);
      // Give remainder to last segment to ensure total is exactly 100%
      this.monoPercentage = 100 - this.saturatedPercentage - this.polyPercentage;
    } else {
      this.saturatedPercentage = this.polyPercentage = this.monoPercentage = 0;
    }

    // Calculate target percentages - only 3 fats
    const totalTargetGrams = this.saturatedTargetGrams + this.polyTargetGrams + this.monoTargetGrams;
    if (totalTargetGrams > 0) {
      this.saturatedTargetPercentage = Math.round((this.saturatedTargetGrams / totalTargetGrams) * 100);
      this.polyTargetPercentage = Math.round((this.polyTargetGrams / totalTargetGrams) * 100);
      // Give remainder to last segment to ensure total is exactly 100%
      this.monoTargetPercentage = 100 - this.saturatedTargetPercentage - this.polyTargetPercentage;
    } else {
      this.saturatedTargetPercentage = this.polyTargetPercentage = this.monoTargetPercentage = 0;
    }

    // Calculate label positions at the midpoint of each segment (only 3 fats now)
    const labelRadius = 28;
    const targetLabelRadius = 45;

    // Saturated: starts at 0%
    const saturatedMidPercent = this.saturatedPercentage / 2;
    const saturatedMidAngle = saturatedMidPercent * 3.6;
    this.saturatedLabelX = 50 + labelRadius * Math.cos((saturatedMidAngle * Math.PI) / 180);
    this.saturatedLabelY = 50 + labelRadius * Math.sin((saturatedMidAngle * Math.PI) / 180);
    this.saturatedLabelRotation = saturatedMidPercent * 3.6 + 90;

    const saturatedTargetMidPercent = this.saturatedTargetPercentage / 2;
    const saturatedTargetMidAngle = saturatedTargetMidPercent * 3.6;
    this.saturatedTargetLabelX = 50 + targetLabelRadius * Math.cos((saturatedTargetMidAngle * Math.PI) / 180);
    this.saturatedTargetLabelY = 50 + targetLabelRadius * Math.sin((saturatedTargetMidAngle * Math.PI) / 180);
    this.saturatedTargetLabelRotation = saturatedTargetMidPercent * 3.6 + 90;

    // Poly: starts after saturated
    const polyMidPercent = this.saturatedPercentage + this.polyPercentage / 2;
    const polyMidAngle = polyMidPercent * 3.6;
    this.polyLabelX = 50 + labelRadius * Math.cos((polyMidAngle * Math.PI) / 180);
    this.polyLabelY = 50 + labelRadius * Math.sin((polyMidAngle * Math.PI) / 180);
    this.polyLabelRotation = polyMidPercent * 3.6 + 90;

    const polyTargetMidPercent = this.saturatedTargetPercentage + this.polyTargetPercentage / 2;
    const polyTargetMidAngle = polyTargetMidPercent * 3.6;
    this.polyTargetLabelX = 50 + targetLabelRadius * Math.cos((polyTargetMidAngle * Math.PI) / 180);
    this.polyTargetLabelY = 50 + targetLabelRadius * Math.sin((polyTargetMidAngle * Math.PI) / 180);
    this.polyTargetLabelRotation = polyTargetMidPercent * 3.6 + 90;

    // Mono: starts after saturated + poly
    const monoMidPercent = this.saturatedPercentage + this.polyPercentage + this.monoPercentage / 2;
    const monoMidAngle = monoMidPercent * 3.6;
    this.monoLabelX = 50 + labelRadius * Math.cos((monoMidAngle * Math.PI) / 180);
    this.monoLabelY = 50 + labelRadius * Math.sin((monoMidAngle * Math.PI) / 180);
    this.monoLabelRotation = monoMidPercent * 3.6 + 90;

    const monoTargetMidPercent = this.saturatedTargetPercentage + this.polyTargetPercentage + this.monoTargetPercentage / 2;
    const monoTargetMidAngle = monoTargetMidPercent * 3.6;
    this.monoTargetLabelX = 50 + targetLabelRadius * Math.cos((monoTargetMidAngle * Math.PI) / 180);
    this.monoTargetLabelY = 50 + targetLabelRadius * Math.sin((monoTargetMidAngle * Math.PI) / 180);
    this.monoTargetLabelRotation = monoTargetMidPercent * 3.6 + 90;
  }
}

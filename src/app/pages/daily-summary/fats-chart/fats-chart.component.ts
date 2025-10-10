import { Component, Input, OnChanges, SimpleChanges, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonGrid, IonRow, IonCol } from '@ionic/angular/standalone';
import { NutrientBreakdown } from 'src/app/services/nutrition-ambition-api.service';

@Component({
  selector: 'app-fats-chart',
  templateUrl: './fats-chart.component.html',
  styleUrls: ['./fats-chart.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonGrid,
    IonRow,
    IonCol
  ]
})
export class FatsChartComponent implements OnChanges, AfterViewInit, OnDestroy {
  @Input() nutrients: NutrientBreakdown[] = [];

  hasData = false;
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

  constructor(private elementRef: ElementRef) {}

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
    // Get fat nutrients
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

    this.hasData = true;

    // Total fat bar
    this.totalFat = Math.round((totalFatNutrient.totalAmount || 0) * 10) / 10;
    this.totalFatTarget = Math.round((totalFatNutrient.maxTarget || totalFatNutrient.minTarget || 0) * 10) / 10;
    this.totalFatPercentage = this.totalFatTarget > 0 ? Math.max((this.totalFat / this.totalFatTarget) * 100, 5) : 15;

    // Get grams for each fat type
    this.transGrams = Math.round((transNutrient?.totalAmount || 0) * 10) / 10;
    this.saturatedGrams = Math.round((saturatedNutrient?.totalAmount || 0) * 10) / 10;
    this.polyGrams = Math.round((polyNutrient?.totalAmount || 0) * 10) / 10;
    this.monoGrams = Math.round((monoNutrient?.totalAmount || 0) * 10) / 10;

    // Get target grams for each fat type
    this.transTargetGrams = Math.round((transNutrient?.maxTarget || transNutrient?.minTarget || 0) * 10) / 10;
    this.saturatedTargetGrams = Math.round((saturatedNutrient?.maxTarget || saturatedNutrient?.minTarget || 0) * 10) / 10;
    this.polyTargetGrams = Math.round((polyNutrient?.maxTarget || polyNutrient?.minTarget || 0) * 10) / 10;
    this.monoTargetGrams = Math.round((monoNutrient?.maxTarget || monoNutrient?.minTarget || 0) * 10) / 10;

    // Calculate percentages for donut (actual consumption)
    const totalGrams = this.transGrams + this.saturatedGrams + this.polyGrams + this.monoGrams;
    if (totalGrams > 0) {
      this.transPercentage = Math.round((this.transGrams / totalGrams) * 100);
      this.saturatedPercentage = Math.round((this.saturatedGrams / totalGrams) * 100);
      this.polyPercentage = Math.round((this.polyGrams / totalGrams) * 100);
      this.monoPercentage = Math.round((this.monoGrams / totalGrams) * 100);
    } else {
      this.transPercentage = this.saturatedPercentage = this.polyPercentage = this.monoPercentage = 0;
    }

    // Calculate target percentages
    const totalTargetGrams = this.transTargetGrams + this.saturatedTargetGrams + this.polyTargetGrams + this.monoTargetGrams;
    if (totalTargetGrams > 0) {
      this.transTargetPercentage = Math.round((this.transTargetGrams / totalTargetGrams) * 100);
      this.saturatedTargetPercentage = Math.round((this.saturatedTargetGrams / totalTargetGrams) * 100);
      this.polyTargetPercentage = Math.round((this.polyTargetGrams / totalTargetGrams) * 100);
      this.monoTargetPercentage = Math.round((this.monoTargetGrams / totalTargetGrams) * 100);
    } else {
      this.transTargetPercentage = this.saturatedTargetPercentage = this.polyTargetPercentage = this.monoTargetPercentage = 0;
    }

    // Calculate label positions at the midpoint of each segment
    const labelRadius = 28;
    const targetLabelRadius = 45;

    // Trans: starts at 0%
    const transMidPercent = this.transPercentage / 2;
    const transMidAngle = transMidPercent * 3.6;
    this.transLabelX = 50 + labelRadius * Math.cos((transMidAngle * Math.PI) / 180);
    this.transLabelY = 50 + labelRadius * Math.sin((transMidAngle * Math.PI) / 180);
    this.transLabelRotation = transMidPercent * 3.6 + 90;

    const transTargetMidPercent = this.transTargetPercentage / 2;
    const transTargetMidAngle = transTargetMidPercent * 3.6;
    this.transTargetLabelX = 50 + targetLabelRadius * Math.cos((transTargetMidAngle * Math.PI) / 180);
    this.transTargetLabelY = 50 + targetLabelRadius * Math.sin((transTargetMidAngle * Math.PI) / 180);
    this.transTargetLabelRotation = transTargetMidPercent * 3.6 + 90;

    // Saturated: starts after trans
    const saturatedMidPercent = this.transPercentage + this.saturatedPercentage / 2;
    const saturatedMidAngle = saturatedMidPercent * 3.6;
    this.saturatedLabelX = 50 + labelRadius * Math.cos((saturatedMidAngle * Math.PI) / 180);
    this.saturatedLabelY = 50 + labelRadius * Math.sin((saturatedMidAngle * Math.PI) / 180);
    this.saturatedLabelRotation = saturatedMidPercent * 3.6 + 90;

    const saturatedTargetMidPercent = this.transTargetPercentage + this.saturatedTargetPercentage / 2;
    const saturatedTargetMidAngle = saturatedTargetMidPercent * 3.6;
    this.saturatedTargetLabelX = 50 + targetLabelRadius * Math.cos((saturatedTargetMidAngle * Math.PI) / 180);
    this.saturatedTargetLabelY = 50 + targetLabelRadius * Math.sin((saturatedTargetMidAngle * Math.PI) / 180);
    this.saturatedTargetLabelRotation = saturatedTargetMidPercent * 3.6 + 90;

    // Poly: starts after trans + saturated
    const polyMidPercent = this.transPercentage + this.saturatedPercentage + this.polyPercentage / 2;
    const polyMidAngle = polyMidPercent * 3.6;
    this.polyLabelX = 50 + labelRadius * Math.cos((polyMidAngle * Math.PI) / 180);
    this.polyLabelY = 50 + labelRadius * Math.sin((polyMidAngle * Math.PI) / 180);
    this.polyLabelRotation = polyMidPercent * 3.6 + 90;

    const polyTargetMidPercent = this.transTargetPercentage + this.saturatedTargetPercentage + this.polyTargetPercentage / 2;
    const polyTargetMidAngle = polyTargetMidPercent * 3.6;
    this.polyTargetLabelX = 50 + targetLabelRadius * Math.cos((polyTargetMidAngle * Math.PI) / 180);
    this.polyTargetLabelY = 50 + targetLabelRadius * Math.sin((polyTargetMidAngle * Math.PI) / 180);
    this.polyTargetLabelRotation = polyTargetMidPercent * 3.6 + 90;

    // Mono: starts after trans + saturated + poly
    const monoMidPercent = this.transPercentage + this.saturatedPercentage + this.polyPercentage + this.monoPercentage / 2;
    const monoMidAngle = monoMidPercent * 3.6;
    this.monoLabelX = 50 + labelRadius * Math.cos((monoMidAngle * Math.PI) / 180);
    this.monoLabelY = 50 + labelRadius * Math.sin((monoMidAngle * Math.PI) / 180);
    this.monoLabelRotation = monoMidPercent * 3.6 + 90;

    const monoTargetMidPercent = this.transTargetPercentage + this.saturatedTargetPercentage + this.polyTargetPercentage + this.monoTargetPercentage / 2;
    const monoTargetMidAngle = monoTargetMidPercent * 3.6;
    this.monoTargetLabelX = 50 + targetLabelRadius * Math.cos((monoTargetMidAngle * Math.PI) / 180);
    this.monoTargetLabelY = 50 + targetLabelRadius * Math.sin((monoTargetMidAngle * Math.PI) / 180);
    this.monoTargetLabelRotation = monoTargetMidPercent * 3.6 + 90;
  }
}

import { Component, Input, OnChanges, SimpleChanges, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonGrid, IonRow, IonCol, IonIcon } from '@ionic/angular/standalone';
import { NutrientBreakdown } from 'src/app/services/nutrition-ambition-api.service';
import { addIcons } from 'ionicons';
import { nutritionOutline, checkmarkCircleOutline, alertCircleOutline } from 'ionicons/icons';

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

  // Display values for bars
  transGrams = 0;
  transBarHeight = 0;
  transBarHeightTarget = 0;
  saturatedGrams = 0;
  saturatedTargetGrams = 0;
  saturatedBarHeight = 0;
  saturatedBarHeightTarget = 0;
  saturatedTargetPosition = 0;
  polyGrams = 0;
  polyTargetGrams = 0;
  polyBarHeight = 0;
  polyBarHeightTarget = 0;
  polyTargetPosition = 0;
  monoGrams = 0;
  monoTargetGrams = 0;
  monoBarHeight = 0;
  monoBarHeightTarget = 0;
  monoTargetPosition = 0;

  constructor(private elementRef: ElementRef) {
    addIcons({ nutritionOutline, checkmarkCircleOutline, alertCircleOutline });
  }

  ngAfterViewInit(): void {
    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !this.isVisible) {
          this.isVisible = true;
          // Trigger height animation after a small delay
          setTimeout(() => {
            this.transBarHeight = this.transBarHeightTarget;
            this.saturatedBarHeight = this.saturatedBarHeightTarget;
            this.polyBarHeight = this.polyBarHeightTarget;
            this.monoBarHeight = this.monoBarHeightTarget;
          }, 50);
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
    const transNutrient = this.nutrients.find(n => n.nutrientKey?.toLowerCase() === 'trans_fat');
    const saturatedNutrient = this.nutrients.find(n => n.nutrientKey?.toLowerCase() === 'saturated_fat');
    const polyNutrient = this.nutrients.find(n => n.nutrientKey?.toLowerCase() === 'polyunsaturated_fat');
    const monoNutrient = this.nutrients.find(n => n.nutrientKey?.toLowerCase() === 'monounsaturated_fat');

    // Get grams for each fat type
    this.transGrams = Math.round((transNutrient?.totalAmount || 0) * 10) / 10;
    this.saturatedGrams = Math.round((saturatedNutrient?.totalAmount || 0) * 10) / 10;
    this.polyGrams = Math.round((polyNutrient?.totalAmount || 0) * 10) / 10;
    this.monoGrams = Math.round((monoNutrient?.totalAmount || 0) * 10) / 10;

    // Check if we have any actual consumption data
    this.hasData = this.transGrams > 0 || this.saturatedGrams > 0 || this.polyGrams > 0 || this.monoGrams > 0;

    if (!this.hasData) {
      return;
    }

    // Get target grams
    this.saturatedTargetGrams = Math.round((saturatedNutrient?.maxTarget || saturatedNutrient?.minTarget || 0) * 10) / 10;
    this.polyTargetGrams = Math.round((polyNutrient?.maxTarget || polyNutrient?.minTarget || 0) * 10) / 10;
    this.monoTargetGrams = Math.round((monoNutrient?.maxTarget || monoNutrient?.minTarget || 0) * 10) / 10;

    // Check if we have targets
    this.hasTargets = this.saturatedTargetGrams > 0 || this.polyTargetGrams > 0 || this.monoTargetGrams > 0;

    // Find the maximum value to scale all bars consistently
    const maxValue = Math.max(
      this.transGrams,
      this.saturatedGrams,
      this.saturatedTargetGrams,
      this.polyGrams,
      this.polyTargetGrams,
      this.monoGrams,
      this.monoTargetGrams
    );

    // Calculate bar heights as percentage of max (with a minimum for visibility)
    // Store as target heights - actual heights will be animated from 0
    if (maxValue > 0) {
      this.transBarHeightTarget = Math.max((this.transGrams / maxValue) * 100, this.transGrams > 0 ? 5 : 0);
      this.saturatedBarHeightTarget = Math.max((this.saturatedGrams / maxValue) * 100, this.saturatedGrams > 0 ? 5 : 0);
      this.polyBarHeightTarget = Math.max((this.polyGrams / maxValue) * 100, this.polyGrams > 0 ? 5 : 0);
      this.monoBarHeightTarget = Math.max((this.monoGrams / maxValue) * 100, this.monoGrams > 0 ? 5 : 0);

      // Calculate target line positions
      this.saturatedTargetPosition = (this.saturatedTargetGrams / maxValue) * 100;
      this.polyTargetPosition = (this.polyTargetGrams / maxValue) * 100;
      this.monoTargetPosition = (this.monoTargetGrams / maxValue) * 100;

      // If already visible, trigger animation immediately
      if (this.isVisible) {
        setTimeout(() => {
          this.transBarHeight = this.transBarHeightTarget;
          this.saturatedBarHeight = this.saturatedBarHeightTarget;
          this.polyBarHeight = this.polyBarHeightTarget;
          this.monoBarHeight = this.monoBarHeightTarget;
        }, 50);
      }
    }
  }
}

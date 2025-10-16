import { Component, Input, OnChanges, SimpleChanges, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonGrid, IonRow, IonCol, IonIcon } from '@ionic/angular/standalone';
import { NutrientBreakdown } from 'src/app/services/nutrition-ambition-api.service';
import { addIcons } from 'ionicons';
import { nutritionOutline } from 'ionicons/icons';

@Component({
  selector: 'app-minerals-chart',
  templateUrl: './minerals-chart.component.html',
  styleUrls: ['./minerals-chart.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonIcon
  ]
})
export class MineralsChartComponent implements OnChanges, AfterViewInit, OnDestroy {
  @Input() nutrients: NutrientBreakdown[] = [];

  hasData = false;
  hasTargets = false;
  isVisible = false;
  private observer: IntersectionObserver | null = null;

  // Display values for bars
  ironGrams = 0;
  ironTargetGrams = 0;
  ironBarHeight = 0;
  ironBarHeightTarget = 0;
  ironTargetPosition = 0;

  zincGrams = 0;
  zincTargetGrams = 0;
  zincBarHeight = 0;
  zincBarHeightTarget = 0;
  zincTargetPosition = 0;

  seleniumGrams = 0;
  seleniumTargetGrams = 0;
  seleniumBarHeight = 0;
  seleniumBarHeightTarget = 0;
  seleniumTargetPosition = 0;

  copperGrams = 0;
  copperTargetGrams = 0;
  copperBarHeight = 0;
  copperBarHeightTarget = 0;
  copperTargetPosition = 0;

  manganeseGrams = 0;
  manganeseTargetGrams = 0;
  manganeseBarHeight = 0;
  manganeseBarHeightTarget = 0;
  manganeseTargetPosition = 0;

  phosphorusGrams = 0;
  phosphorusTargetGrams = 0;
  phosphorusBarHeight = 0;
  phosphorusBarHeightTarget = 0;
  phosphorusTargetPosition = 0;

  constructor(private elementRef: ElementRef) {
    addIcons({ nutritionOutline });
  }

  ngAfterViewInit(): void {
    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !this.isVisible) {
          this.isVisible = true;
          // Trigger height animation after a small delay
          setTimeout(() => {
            this.ironBarHeight = this.ironBarHeightTarget;
            this.zincBarHeight = this.zincBarHeightTarget;
            this.seleniumBarHeight = this.seleniumBarHeightTarget;
            this.copperBarHeight = this.copperBarHeightTarget;
            this.manganeseBarHeight = this.manganeseBarHeightTarget;
            this.phosphorusBarHeight = this.phosphorusBarHeightTarget;
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
    // Get mineral nutrients
    const ironNutrient = this.nutrients.find(n => n.nutrientKey?.toLowerCase() === 'iron');
    const zincNutrient = this.nutrients.find(n => n.nutrientKey?.toLowerCase() === 'zinc');
    const seleniumNutrient = this.nutrients.find(n => n.nutrientKey?.toLowerCase() === 'selenium');
    const copperNutrient = this.nutrients.find(n => n.nutrientKey?.toLowerCase() === 'copper');
    const manganeseNutrient = this.nutrients.find(n => n.nutrientKey?.toLowerCase() === 'manganese');
    const phosphorusNutrient = this.nutrients.find(n => n.nutrientKey?.toLowerCase() === 'phosphorus');

    // Get amounts for each mineral (in mg/mcg)
    this.ironGrams = Math.round((ironNutrient?.totalAmount || 0) * 10) / 10;
    this.zincGrams = Math.round((zincNutrient?.totalAmount || 0) * 10) / 10;
    this.seleniumGrams = Math.round((seleniumNutrient?.totalAmount || 0) * 10) / 10;
    this.copperGrams = Math.round((copperNutrient?.totalAmount || 0) * 10) / 10;
    this.manganeseGrams = Math.round((manganeseNutrient?.totalAmount || 0) * 10) / 10;
    this.phosphorusGrams = Math.round((phosphorusNutrient?.totalAmount || 0) * 10) / 10;

    // Check if we have any actual consumption data
    this.hasData = this.ironGrams > 0 || this.zincGrams > 0 || this.seleniumGrams > 0
      || this.copperGrams > 0 || this.manganeseGrams > 0 || this.phosphorusGrams > 0;

    if (!this.hasData) {
      return;
    }

    // Get target amounts
    this.ironTargetGrams = Math.round((ironNutrient?.maxTarget || ironNutrient?.minTarget || 0) * 10) / 10;
    this.zincTargetGrams = Math.round((zincNutrient?.maxTarget || zincNutrient?.minTarget || 0) * 10) / 10;
    this.seleniumTargetGrams = Math.round((seleniumNutrient?.maxTarget || seleniumNutrient?.minTarget || 0) * 10) / 10;
    this.copperTargetGrams = Math.round((copperNutrient?.maxTarget || copperNutrient?.minTarget || 0) * 10) / 10;
    this.manganeseTargetGrams = Math.round((manganeseNutrient?.maxTarget || manganeseNutrient?.minTarget || 0) * 10) / 10;
    this.phosphorusTargetGrams = Math.round((phosphorusNutrient?.maxTarget || phosphorusNutrient?.minTarget || 0) * 10) / 10;

    // Check if we have targets
    this.hasTargets = this.ironTargetGrams > 0 || this.zincTargetGrams > 0 || this.seleniumTargetGrams > 0
      || this.copperTargetGrams > 0 || this.manganeseTargetGrams > 0 || this.phosphorusTargetGrams > 0;

    // Find the maximum value to scale all bars consistently
    const maxValue = Math.max(
      this.ironGrams,
      this.ironTargetGrams,
      this.zincGrams,
      this.zincTargetGrams,
      this.seleniumGrams,
      this.seleniumTargetGrams,
      this.copperGrams,
      this.copperTargetGrams,
      this.manganeseGrams,
      this.manganeseTargetGrams,
      this.phosphorusGrams,
      this.phosphorusTargetGrams
    );

    // Calculate bar heights as percentage of max (with a minimum for visibility)
    // Store as target heights - actual heights will be animated from 0
    if (maxValue > 0) {
      this.ironBarHeightTarget = Math.max((this.ironGrams / maxValue) * 100, this.ironGrams > 0 ? 5 : 0);
      this.zincBarHeightTarget = Math.max((this.zincGrams / maxValue) * 100, this.zincGrams > 0 ? 5 : 0);
      this.seleniumBarHeightTarget = Math.max((this.seleniumGrams / maxValue) * 100, this.seleniumGrams > 0 ? 5 : 0);
      this.copperBarHeightTarget = Math.max((this.copperGrams / maxValue) * 100, this.copperGrams > 0 ? 5 : 0);
      this.manganeseBarHeightTarget = Math.max((this.manganeseGrams / maxValue) * 100, this.manganeseGrams > 0 ? 5 : 0);
      this.phosphorusBarHeightTarget = Math.max((this.phosphorusGrams / maxValue) * 100, this.phosphorusGrams > 0 ? 5 : 0);

      // Calculate target line positions
      this.ironTargetPosition = (this.ironTargetGrams / maxValue) * 100;
      this.zincTargetPosition = (this.zincTargetGrams / maxValue) * 100;
      this.seleniumTargetPosition = (this.seleniumTargetGrams / maxValue) * 100;
      this.copperTargetPosition = (this.copperTargetGrams / maxValue) * 100;
      this.manganeseTargetPosition = (this.manganeseTargetGrams / maxValue) * 100;
      this.phosphorusTargetPosition = (this.phosphorusTargetGrams / maxValue) * 100;

      // If already visible, trigger animation immediately
      if (this.isVisible) {
        setTimeout(() => {
          this.ironBarHeight = this.ironBarHeightTarget;
          this.zincBarHeight = this.zincBarHeightTarget;
          this.seleniumBarHeight = this.seleniumBarHeightTarget;
          this.copperBarHeight = this.copperBarHeightTarget;
          this.manganeseBarHeight = this.manganeseBarHeightTarget;
          this.phosphorusBarHeight = this.phosphorusBarHeightTarget;
        }, 50);
      }
    }
  }
}

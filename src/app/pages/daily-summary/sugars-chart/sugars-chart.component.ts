import { Component, Input, OnChanges, SimpleChanges, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonGrid, IonRow, IonCol, IonIcon } from '@ionic/angular/standalone';
import { NutrientBreakdown } from 'src/app/services/nutrition-ambition-api.service';
import { addIcons } from 'ionicons';
import { nutritionOutline } from 'ionicons/icons';

@Component({
  selector: 'app-sugars-chart',
  templateUrl: './sugars-chart.component.html',
  styleUrls: ['./sugars-chart.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonIcon
  ]
})
export class SugarsChartComponent implements OnChanges, AfterViewInit, OnDestroy {
  @Input() nutrients: NutrientBreakdown[] = [];

  hasData = false;
  hasTargets = false;
  isVisible = false;
  private observer: IntersectionObserver | null = null;

  // Display values for bars
  totalSugarsGrams = 0;
  totalSugarsTargetGrams = 0;
  totalSugarsBarHeight = 0;
  totalSugarsBarHeightTarget = 0;
  totalSugarsTargetPosition = 0;
  addedSugarsGrams = 0;
  addedSugarsTargetGrams = 0;
  addedSugarsBarHeight = 0;
  addedSugarsBarHeightTarget = 0;
  addedSugarsTargetPosition = 0;

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
            this.totalSugarsBarHeight = this.totalSugarsBarHeightTarget;
            this.addedSugarsBarHeight = this.addedSugarsBarHeightTarget;
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
    // Get sugar nutrients
    const totalSugarsNutrient = this.nutrients.find(n => n.nutrientKey?.toLowerCase() === 'sugar' || n.nutrientKey?.toLowerCase() === 'total_sugars');
    const addedSugarsNutrient = this.nutrients.find(n => n.nutrientKey?.toLowerCase() === 'added_sugars');

    // Get grams for each sugar type
    this.totalSugarsGrams = Math.round((totalSugarsNutrient?.totalAmount || 0) * 10) / 10;
    this.addedSugarsGrams = Math.round((addedSugarsNutrient?.totalAmount || 0) * 10) / 10;

    // Check if we have any actual consumption data
    this.hasData = this.totalSugarsGrams > 0 || this.addedSugarsGrams > 0;

    if (!this.hasData) {
      return;
    }

    // Get target grams
    this.totalSugarsTargetGrams = Math.round((totalSugarsNutrient?.maxTarget || totalSugarsNutrient?.minTarget || 0) * 10) / 10;
    this.addedSugarsTargetGrams = Math.round((addedSugarsNutrient?.maxTarget || addedSugarsNutrient?.minTarget || 0) * 10) / 10;

    // Check if we have targets
    this.hasTargets = this.totalSugarsTargetGrams > 0 || this.addedSugarsTargetGrams > 0;

    // Find the maximum value to scale all bars consistently
    const maxValue = Math.max(
      this.totalSugarsGrams,
      this.totalSugarsTargetGrams,
      this.addedSugarsGrams,
      this.addedSugarsTargetGrams
    );

    // Calculate bar heights as percentage of max (with a minimum for visibility)
    // Store as target heights - actual heights will be animated from 0
    if (maxValue > 0) {
      this.totalSugarsBarHeightTarget = Math.max((this.totalSugarsGrams / maxValue) * 100, this.totalSugarsGrams > 0 ? 5 : 0);
      this.addedSugarsBarHeightTarget = Math.max((this.addedSugarsGrams / maxValue) * 100, this.addedSugarsGrams > 0 ? 5 : 0);

      // Calculate target line positions
      this.totalSugarsTargetPosition = (this.totalSugarsTargetGrams / maxValue) * 100;
      this.addedSugarsTargetPosition = (this.addedSugarsTargetGrams / maxValue) * 100;

      // If already visible, trigger animation immediately
      if (this.isVisible) {
        setTimeout(() => {
          this.totalSugarsBarHeight = this.totalSugarsBarHeightTarget;
          this.addedSugarsBarHeight = this.addedSugarsBarHeightTarget;
        }, 50);
      }
    }
  }
}

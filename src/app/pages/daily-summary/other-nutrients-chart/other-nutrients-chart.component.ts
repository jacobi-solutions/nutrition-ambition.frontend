import { Component, Input, OnChanges, SimpleChanges, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonGrid, IonRow, IonCol, IonIcon } from '@ionic/angular/standalone';
import { NutrientBreakdown } from 'src/app/services/nutrition-ambition-api.service';
import { addIcons } from 'ionicons';
import { nutritionOutline } from 'ionicons/icons';

interface NutrientBar {
  nutrient: NutrientBreakdown;
  barHeight: number;
  barHeightTarget: number;
  targetPosition: number;
  displayValue: string;
}

@Component({
  selector: 'app-other-nutrients-chart',
  templateUrl: './other-nutrients-chart.component.html',
  styleUrls: ['./other-nutrients-chart.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonIcon
  ]
})
export class OtherNutrientsChartComponent implements OnChanges, AfterViewInit, OnDestroy {
  @Input() nutrients: NutrientBreakdown[] = [];

  hasData = false;
  hasTargets = false;
  isVisible = false;
  private observer: IntersectionObserver | null = null;

  // Dynamic list of nutrient bars
  nutrientBars: NutrientBar[] = [];

  // Color palette for bars (cycle through these)
  private colorPalette = [
    '#D64933', // tomato
    '#FF8A5C', // salmon
    '#4E6E5D', // sage
    '#8BA89C', // olive
    '#BED9C6', // light sage
    '#FFB896', // light salmon
  ];

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
            this.nutrientBars.forEach(bar => {
              bar.barHeight = bar.barHeightTarget;
            });
          }, 50);
        }
      });
    }, {
      threshold: 0,
      rootMargin: '0px 0px 0px 0px' // Trigger as soon as any part is visible
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
    // Filter nutrients that have data
    const nutrientsWithData = this.nutrients.filter(n => (n.totalAmount || 0) > 0);

    this.hasData = nutrientsWithData.length > 0;

    if (!this.hasData) {
      this.nutrientBars = [];
      return;
    }

    // Check if any have targets
    this.hasTargets = nutrientsWithData.some(n =>
      (n.maxTarget !== undefined && n.maxTarget !== null && n.maxTarget > 0) ||
      (n.minTarget !== undefined && n.minTarget !== null && n.minTarget > 0)
    );

    // Find the maximum value to scale all bars consistently
    const maxValue = Math.max(
      ...nutrientsWithData.map(n => {
        const amount = n.totalAmount || 0;
        const target = n.maxTarget || n.minTarget || 0;
        return Math.max(amount, target);
      })
    );

    // Create bar objects
    this.nutrientBars = nutrientsWithData.map((nutrient, index) => {
      const amount = Math.round((nutrient.totalAmount || 0) * 10) / 10;
      const target = Math.round((nutrient.maxTarget || nutrient.minTarget || 0) * 10) / 10;

      // Determine display unit (mg or mcg or g)
      let displayValue = `${amount}`;
      const unit = nutrient.unit?.toLowerCase() || 'mg';
      if (unit.includes('mcg') || unit.includes('µg')) {
        displayValue = `${amount}mcg`;
      } else if (unit.includes('mg')) {
        displayValue = `${amount}mg`;
      } else if (unit.includes('g')) {
        displayValue = `${amount}g`;
      } else {
        displayValue = `${amount}${unit}`;
      }

      const barHeightTarget = maxValue > 0
        ? Math.max((amount / maxValue) * 100, amount > 0 ? 5 : 0)
        : 0;

      const targetPosition = maxValue > 0 ? (target / maxValue) * 100 : 0;

      return {
        nutrient,
        barHeight: 0, // Will be animated
        barHeightTarget,
        targetPosition,
        displayValue
      };
    });

    // If already visible, trigger animation immediately
    if (this.isVisible) {
      setTimeout(() => {
        this.nutrientBars.forEach(bar => {
          bar.barHeight = bar.barHeightTarget;
        });
      }, 50);
    }
  }

  getBarColor(index: number): string {
    return this.colorPalette[index % this.colorPalette.length];
  }

  hasTarget(bar: NutrientBar): boolean {
    return this.hasTargets &&
      ((bar.nutrient.maxTarget !== undefined && bar.nutrient.maxTarget !== null && bar.nutrient.maxTarget > 0) ||
       (bar.nutrient.minTarget !== undefined && bar.nutrient.minTarget !== null && bar.nutrient.minTarget > 0));
  }
}

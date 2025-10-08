import { Component, Input, OnChanges, SimpleChanges, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonGrid, IonRow, IonCol } from '@ionic/angular/standalone';
import { NutrientBreakdown } from 'src/app/services/nutrition-ambition-api.service';

interface ElectrolyteData {
  key: string;
  name: string;
  consumed: number;
  target: number;
  percentage: number; // percentage of target (can be > 100)
  radius: number; // calculated radius for pie segment
  color: string;
  startAngle: number;
  endAngle: number;
  // Precomputed values
  segmentPath: string;
  targetStrokeDasharray: string;
  targetStrokeDashoffset: number;
  labelX: number;
  labelY: number;
}

@Component({
  selector: 'app-electrolytes-chart',
  templateUrl: './electrolytes-chart.component.html',
  styleUrls: ['./electrolytes-chart.component.scss'],
  standalone: true,
  imports: [CommonModule, IonGrid, IonRow, IonCol]
})
export class ElectrolytesChartComponent implements OnChanges, AfterViewInit, OnDestroy {
  @Input() nutrients: NutrientBreakdown[] = [];

  hasData = false;
  isVisible = false;
  electrolytes: ElectrolyteData[] = [];
  maxRadius = 45; // Maximum radius for 100%+ consumption
  minRadius = 15; // Minimum radius for low consumption
  targetRingRadius = 45; // Fixed outer ring showing 100% target
  private observer: IntersectionObserver | null = null;

  // Color palette for electrolytes - matching app theme
  private colors = {
    sodium: '#A9C8B2',    // sage (high alert for sodium)
    potassium: '#FF8A5C',   // salmon (earthy/balanced)
    magnesium: '#4E6E5D',   // olive (calm/balanced)
    calcium: '#D64933'      // tomato (fitting for calcium)
  };

  constructor(private elementRef: ElementRef) {}

  ngAfterViewInit(): void {
    // Set up Intersection Observer to trigger animations when chart is visible
    // rootMargin: '-50% 0px -50% 0px' means only trigger when element is in middle 50% of viewport
    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !this.isVisible) {
          this.isVisible = true;
        }
      });
    }, {
      threshold: 0,
      rootMargin: '-50% 0px -50% 0px'  // Only trigger when element is halfway up the screen
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
      this.computeElectrolytes();
    }
  }

  private computeElectrolytes(): void {
    const electrolyteKeys = ['sodium', 'potassium', 'magnesium', 'calcium'];

    // Filter and sort by the order defined in electrolyteKeys
    const electrolyteNutrients = electrolyteKeys
      .map(key => this.nutrients.find(n => n.nutrientKey?.toLowerCase() === key))
      .filter(n => n !== undefined) as typeof this.nutrients;

    if (electrolyteNutrients.length === 0) {
      this.hasData = false;
      return;
    }

    this.hasData = true;

    // Calculate total target for proportional angle distribution
    const totalTarget = electrolyteNutrients.reduce((sum, n) => {
      return sum + (n.maxTarget || n.minTarget || 0);
    }, 0);

    let cumulativeAngle = 0;

    this.electrolytes = electrolyteNutrients.map((nutrient, index) => {
      const key = nutrient.nutrientKey?.toLowerCase() || '';
      const consumed = nutrient.totalAmount || 0;
      const target = nutrient.maxTarget || nutrient.minTarget || 1;
      const percentage = (consumed / target) * 100;

      // Calculate radius based on percentage (capped at maxRadius)
      // 0% = minRadius, 100% = targetRingRadius, >100% can go up to maxRadius
      let radius: number;
      if (percentage <= 100) {
        radius = this.minRadius + ((this.targetRingRadius - this.minRadius) * (percentage / 100));
      } else {
        // Beyond 100%, can grow slightly more
        const overage = Math.min(percentage - 100, 50); // Cap at 150%
        radius = this.targetRingRadius + ((this.maxRadius - this.targetRingRadius) * (overage / 50));
      }

      // Calculate angle proportional to target amount
      const angleForThisSegment = (target / totalTarget) * 360;
      const startAngle = cumulativeAngle;
      const endAngle = cumulativeAngle + angleForThisSegment;
      cumulativeAngle = endAngle;

      const color = this.colors[key as keyof typeof this.colors] || '#A3A3A3';

      // Precompute SVG path for actual consumption (variable radius)
      const segmentPath = this.computeSegmentPath(radius, startAngle, endAngle);

      // Precompute target ring stroke-dasharray and offset
      const circumference = 2 * Math.PI * this.targetRingRadius;
      const arcLength = ((endAngle - startAngle) / 360) * circumference;
      const targetStrokeDasharray = `${arcLength} ${circumference}`;
      const targetStrokeDashoffset = -(startAngle / 360) * circumference;

      // Precompute percentage label position
      const labelAngle = (startAngle + endAngle) / 2;
      const labelRadius = radius * 0.7;
      const labelPosition = this.polarToCartesian(50, 50, labelRadius, labelAngle);

      return {
        key,
        name: nutrient.nutrientName || key,
        consumed: Math.round(consumed * 10) / 10,
        target: Math.round(target * 10) / 10,
        percentage: Math.round(percentage),
        radius: Math.round(radius * 10) / 10,
        color,
        startAngle,
        endAngle,
        segmentPath,
        targetStrokeDasharray,
        targetStrokeDashoffset,
        labelX: labelPosition.x,
        labelY: labelPosition.y
      };
    });
  }

  // Compute SVG path for a pie segment with variable radius
  private computeSegmentPath(radius: number, startAngle: number, endAngle: number): string {
    const centerX = 50;
    const centerY = 50;

    const start = this.polarToCartesian(centerX, centerY, radius, endAngle);
    const end = this.polarToCartesian(centerX, centerY, radius, startAngle);

    const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';

    return [
      `M ${centerX} ${centerY}`,
      `L ${start.x} ${start.y}`,
      `A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`,
      'Z'
    ].join(' ');
  }

  // Helper to convert polar to cartesian coordinates
  private polarToCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number) {
    const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
    return {
      x: centerX + (radius * Math.cos(angleInRadians)),
      y: centerY + (radius * Math.sin(angleInRadians))
    };
  }
}

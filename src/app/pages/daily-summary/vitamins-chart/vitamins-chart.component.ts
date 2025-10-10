import { Component, Input, OnInit, OnChanges, SimpleChanges, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NutrientBreakdown } from 'src/app/services/nutrition-ambition-api.service';

interface VitaminData {
  label: string;
  key: string;
  consumed: number;
  target: number;
  percentOfTarget: number;
  barWidth: string;
  barColor: string;
  isFatSoluble: boolean;
}

@Component({
  selector: 'app-vitamins-chart',
  templateUrl: './vitamins-chart.component.html',
  styleUrls: ['./vitamins-chart.component.scss'],
  standalone: true,
  imports: [CommonModule]
})
export class VitaminsChartComponent implements OnChanges, AfterViewInit, OnDestroy {
  @Input() nutrients: NutrientBreakdown[] = [];

  fatSolubleVitamins: VitaminData[] = [];
  waterSolubleVitamins: VitaminData[] = [];
  isVisible = false;
  private observer: IntersectionObserver | null = null;

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
    if (changes['nutrients']) {
      this.computeVitamins();
    }
  }

  private computeVitamins(): void {
    // Fat-soluble vitamins: A, D, E, K (sage color)
    const fatSolubleData = [
      { label: 'A', key: 'vitamin_a' },
      { label: 'D', key: 'vitamin_d' },
      { label: 'E', key: 'vitamin_e' },
      { label: 'K', key: 'vitamin_k' }
    ];

    // Water-soluble vitamins: B vitamins and C (salmon color)
    const waterSolubleData = [
      { label: 'C', key: 'vitamin_c' },
      { label: 'B1', key: 'thiamin' },
      { label: 'B2', key: 'riboflavin' },
      { label: 'B3', key: 'niacin' },
      { label: 'B5', key: 'pantothenic_acid' },
      { label: 'B6', key: 'vitamin_b6' },
      { label: 'B9', key: 'folate' },
      { label: 'B12', key: 'vitamin_b12' }
    ];

    this.fatSolubleVitamins = fatSolubleData.map(v => this.createVitaminData(v, true));
    this.waterSolubleVitamins = waterSolubleData.map(v => this.createVitaminData(v, false));
  }

  private createVitaminData(vitaminInfo: {label: string, key: string}, isFatSoluble: boolean): VitaminData {
    const vitamin = this.nutrients.find(n => n.nutrientKey?.toLowerCase() === vitaminInfo.key.toLowerCase());

    const consumed = vitamin?.totalAmount || 0;
    const target = vitamin?.maxTarget || vitamin?.minTarget || 1;
    const percentage = (consumed / target) * 100;

    // Clamp to 0-150% for bar display
    const cappedPercentage = Math.min(percentage, 150);
    const barWidth = `${cappedPercentage}%`;

    // Color based on vitamin type
    const barColor = isFatSoluble ? '#A9C8B2' : '#FF8A5C'; // sage for fat-soluble, salmon for water-soluble

    return {
      label: vitaminInfo.label,
      key: vitaminInfo.key,
      consumed: Math.round(consumed * 10) / 10,
      target: Math.round(target * 10) / 10,
      percentOfTarget: Math.round(percentage),
      barWidth,
      barColor,
      isFatSoluble
    };
  }

  private interpolateColor(startHex: string, endHex: string, ratio: number): string {
    const start = this.hexToRgb(startHex);
    const end = this.hexToRgb(endHex);

    const r = Math.round(start.r + (end.r - start.r) * ratio);
    const g = Math.round(start.g + (end.g - start.g) * ratio);
    const b = Math.round(start.b + (end.b - start.b) * ratio);

    return this.rgbToHex(r, g, b);
  }

  private hexToRgb(hex: string): {r: number, g: number, b: number} {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : {r: 0, g: 0, b: 0};
  }

  private rgbToHex(r: number, g: number, b: number): string {
    return '#' + [r, g, b].map(x => {
      const hex = x.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
  }

  private getLuminance(hex: string): number {
    const rgb = this.hexToRgb(hex);
    const [r, g, b] = [rgb.r, rgb.g, rgb.b].map(val => {
      const normalized = val / 255;
      return normalized <= 0.03928
        ? normalized / 12.92
        : Math.pow((normalized + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
}

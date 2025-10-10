import { Component, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonGrid, IonRow, IonCol } from '@ionic/angular/standalone';
import { NutrientBreakdown } from 'src/app/services/nutrition-ambition-api.service';

interface VitaminData {
  label: string;
  key: string;
  percentOfTarget: number;
  backgroundColor: string;
  textColor: string;
}

@Component({
  selector: 'app-vitamins-chart',
  templateUrl: './vitamins-chart.component.html',
  styleUrls: ['./vitamins-chart.component.scss'],
  standalone: true,
  imports: [CommonModule, IonGrid, IonRow, IonCol]
})
export class VitaminsChartComponent implements OnChanges {
  @Input() nutrients: NutrientBreakdown[] = [];

  vitaminSquares: VitaminData[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['nutrients']) {
      this.computeVitamins();
    }
  }

  private computeVitamins(): void {
    const vitaminData = [
      { label: 'A', key: 'vitamin_a' },
      { label: 'C', key: 'vitamin_c' },
      { label: 'D', key: 'vitamin_d' },
      { label: 'E', key: 'vitamin_e' },
      { label: 'K', key: 'vitamin_k' },
      { label: 'B1', key: 'thiamin' },
      { label: 'B2', key: 'riboflavin' },
      { label: 'B3', key: 'niacin' },
      { label: 'B6', key: 'vitamin_b6' },
      { label: 'B9', key: 'folate' },
      { label: 'B12', key: 'vitamin_b12' },
      { label: 'B5', key: 'pantothenic_acid' }
    ];

    this.vitaminSquares = vitaminData.map(v => {
      const vitamin = this.nutrients.find(n => n.nutrientKey?.toLowerCase() === v.key.toLowerCase());

      const consumed = vitamin?.totalAmount || 0;
      const target = vitamin?.maxTarget || vitamin?.minTarget || 1;
      const percentage = (consumed / target) * 100;

      // Clamp to 0-120%
      const p = Math.min(Math.max(percentage, 0), 120);

      let backgroundColor: string;
      // Simplified 3-color palette
      if (p < 60) {
        backgroundColor = '#D64933'; // tomato
      } else if (p < 100) {
        backgroundColor = '#FF8A5C'; // salmon
      } else {
        backgroundColor = '#A9C8B2'; // sage
      }


      // Original gradient logic (commented out)
      // if (p < 50) {
      //   backgroundColor = this.interpolateColor('#F8D9CC', '#F7B28A', p / 50);
      // } else if (p < 90) {
      //   backgroundColor = this.interpolateColor('#F7B28A', '#97AF99', (p - 50) / 40);
      // } else if (p < 110) {
      //   backgroundColor = '#97AF99';
      // } else {
      //   backgroundColor = '#7AA786';
      // }

      const textColor = '#FFFFFF'; // Always white text for these colors

      return {
        label: v.label,
        key: v.key,
        percentOfTarget: Math.round(percentage),
        backgroundColor,
        textColor
      };
    });
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

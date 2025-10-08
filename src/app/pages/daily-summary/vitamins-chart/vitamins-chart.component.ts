import { Component, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonGrid, IonRow, IonCol } from '@ionic/angular/standalone';
import { NutrientBreakdown } from 'src/app/services/nutrition-ambition-api.service';

interface VitaminData {
  key: string;
  name: string;
  displayName: string;
  consumed: number;
  target: number;
  percentage: number;
  color: string;
  unit: string;
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

  hasData = true;
  vitaminRows: VitaminData[][] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['nutrients']) {
      this.computeVitamins();
    }
  }

  private computeVitamins(): void {
    // Ultra-simplified - just create test data
    const testVitamins: VitaminData[] = [
      { key: 'a', name: 'Vitamin A', displayName: 'A', consumed: 50, target: 100, percentage: 50, color: '#FF8A5C', unit: 'mcg' },
      { key: 'c', name: 'Vitamin C', displayName: 'C', consumed: 100, target: 100, percentage: 100, color: '#4E6E5D', unit: 'mg' },
      { key: 'd', name: 'Vitamin D', displayName: 'D', consumed: 25, target: 100, percentage: 25, color: '#D64933', unit: 'mcg' }
    ];

    // Create one row
    this.vitaminRows = [testVitamins];
    this.hasData = true;
  }
}

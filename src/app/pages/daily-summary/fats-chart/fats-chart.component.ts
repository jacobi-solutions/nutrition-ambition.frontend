import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NutrientBreakdown } from 'src/app/services/nutrition-ambition-api.service';

@Component({
  selector: 'app-fats-chart',
  templateUrl: './fats-chart.component.html',
  styleUrls: ['./fats-chart.component.scss'],
  standalone: true,
  imports: [CommonModule]
})
export class FatsChartComponent implements OnChanges {
  @Input() nutrients: NutrientBreakdown[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['nutrients']) {
      // Will implement chart logic here
    }
  }
}

import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';

@Component({
  selector: 'app-electrolytes-chart',
  templateUrl: './electrolytes-chart.component.html',
  styleUrls: ['./electrolytes-chart.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule]
})
export class ElectrolytesChartComponent implements OnInit {
  @Input() nutrients: any[] = [];

  ngOnInit() {
  }
}

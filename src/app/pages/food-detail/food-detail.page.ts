import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { Router, RouterLink } from '@angular/router';
import { NutritionVisualizationComponent } from 'src/app/pages/food-logging/nutrition-visualization/nutrition-visualization.component';

@Component({
  selector: 'app-food-detail',
  templateUrl: './food-detail.page.html',
  styleUrls: ['./food-detail.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonicModule,
    NutritionVisualizationComponent
  ]
})
export class FoodDetailPage implements OnInit {
  @Input() nutritionData: any;

  constructor(private router: Router) { }

  ngOnInit() {
    if (!this.nutritionData) {
      const nav = this.router.getCurrentNavigation();
      this.nutritionData = nav?.extras?.state?.['nutritionData'] || null;
    }
  }
} 
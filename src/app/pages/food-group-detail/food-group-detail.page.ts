import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { Router, RouterModule } from '@angular/router';
import { FoodItem } from 'src/app/services/nutrition-ambition-api.service';
import { AppHeaderComponent } from '../../components/app-header/app-header.component';

// Import the nutrition visualization component
import { NutritionVisualizationComponent } from 'src/app/pages/food-logging/nutrition-visualization/nutrition-visualization.component';

@Component({
  selector: 'app-food-group-detail',
  templateUrl: './food-group-detail.page.html',
  styleUrls: ['./food-group-detail.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, RouterModule, AppHeaderComponent]
})
export class FoodGroupDetailPage implements OnInit {

  groupName: string = 'Group Details';
  items: FoodItem[] = [];
  entryTime: string = ''; // ISO string or Date object

  constructor(private router: Router) { }

  ngOnInit() {
    const nav = this.router.getCurrentNavigation();
    this.groupName = nav?.extras?.state?.['groupName'] || 'Group Details';
    this.items = nav?.extras?.state?.['items'] || [];
    this.entryTime = nav?.extras?.state?.['entryTime'] || '';
  }

  // Method to view nutrition details for a single item
  viewItemNutrition(item: FoodItem) {
    this.router.navigate(['/food-detail'], {
      state: { nutritionData: { foods: [item] } }
    });
  }
} 
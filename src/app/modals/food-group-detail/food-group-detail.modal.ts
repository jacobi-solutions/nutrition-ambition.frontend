import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ModalController } from '@ionic/angular';
import { FoodItem } from 'src/app/services/nutrition-ambition-api.service';

// Import the nutrition visualization modal
import { NutritionVisualizationComponent } from 'src/app/pages/food-logging/nutrition-visualization/nutrition-visualization.component';

@Component({
  selector: 'app-food-group-detail-modal',
  templateUrl: './food-group-detail.modal.html',
  styleUrls: ['./food-group-detail.modal.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule]
})
export class FoodGroupDetailModalComponent implements OnInit {

  @Input() groupName: string = 'Group Details';
  @Input() items: FoodItem[] = [];
  @Input() entryTime: string = ''; // ISO string or Date object

  constructor(private modalCtrl: ModalController) { }

  ngOnInit() { }

  dismiss() {
    this.modalCtrl.dismiss();
  }

  // Method to open the nutrition visualization for a single item
  async viewItemNutrition(item: FoodItem) {
    const modal = await this.modalCtrl.create({
      component: NutritionVisualizationComponent,
      componentProps: {
        foodItems: [item] // Pass the single selected item in an array
      }
    });
    await modal.present();
  }
}


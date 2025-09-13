import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon, IonGrid, IonRow, IonCol } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { chevronUpOutline, chevronDownOutline, trashOutline } from 'ionicons/icons';
import { ServingQuantityInputComponent } from 'src/app/components/serving-quantity-input.component/serving-quantity-input.component';

@Component({
  selector: 'app-food-header',
  templateUrl: './food-header.component.html',
  styleUrls: ['./food-header.component.scss'],
  standalone: true,
  imports: [CommonModule, IonIcon, IonGrid, IonRow, IonCol, ServingQuantityInputComponent]
})
export class FoodHeaderComponent implements OnInit, OnChanges {
  @Input() food: any = null;
  @Input() foodIndex: number = 0;
  @Input() isReadOnly: boolean = false;
  @Input() isExpanded: boolean = false;
  @Input() currentQuantity: number = 1;

  @Output() toggleExpansion = new EventEmitter<number>();
  @Output() quantityChanged = new EventEmitter<{foodIndex: number, quantity: number}>();
  @Output() removeFood = new EventEmitter<string>();

  // Precomputed values for performance
  displayName: string = '';
  servingLabel: string = '';
  computedShouldShowQuantityInput: boolean = false;
  computedShouldShowNormalLabel: boolean = false;

  constructor() {
    addIcons({ chevronUpOutline, chevronDownOutline, trashOutline });
  }

  ngOnInit(): void {
    this.computeDisplayValues();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['food'] || changes['currentQuantity'] || changes['isExpanded'] || changes['isReadOnly']) {
      this.computeDisplayValues();
    }
  }

  private computeDisplayValues(): void {
    // Compute display name
    this.displayName = this.food?.name || '';

    // Compute serving label
    if (this.food && this.food.components && this.food.components.length > 1) {
      // For multi-component foods, show the food-level quantity and unit
      const quantity = this.currentQuantity || this.food.quantity || 1;
      const unit = this.food.unit || 'servings';
      this.servingLabel = `${quantity} ${unit}`;
    } else {
      this.servingLabel = '';
    }

    // Compute visibility flags
    this.computedShouldShowQuantityInput = this.isExpanded && !this.isReadOnly;
    this.computedShouldShowNormalLabel = !this.isExpanded || this.isReadOnly;
  }

  onToggleExpansion(): void {
    this.toggleExpansion.emit(this.foodIndex);
  }

  onQuantityChange(newQuantity: number): void {
    this.quantityChanged.emit({
      foodIndex: this.foodIndex,
      quantity: newQuantity
    });
  }

  onRemoveFood(): void {
    if (this.food?.id) {
      this.removeFood.emit(this.food.id);
    }
  }

}
import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FoodHeaderComponent } from '../food-header/food-header.component';
import { FoodComponentItemComponent } from '../food-component-item/food-component-item.component';
import { FoodDisplay } from 'src/app/models/food-selection-display';

@Component({
  selector: 'app-food',
  templateUrl: './food.component.html',
  styleUrls: ['./food.component.scss'],
  standalone: true,
  imports: [CommonModule, FoodHeaderComponent, FoodComponentItemComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FoodComponent implements OnInit, OnChanges {
  @Input() food!: FoodDisplay;
  @Input() foodIndex: number = 0;
  @Input() isReadOnly: boolean = false;
  @Input() isEditMode: boolean = false;

  @Output() foodChanged = new EventEmitter<{ index: number; food: FoodDisplay }>();
  @Output() actionRequested = new EventEmitter<{ action: string; payload: any }>();

  // Precomputed values
  visibleComponents: any[] = [];

  ngOnInit(): void {
    this.computeVisibleComponents();
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Always recompute visible components when food changes
    this.computeVisibleComponents();
  }

  // Helper methods for template
  isMultiComponentFood(): boolean {
    return this.visibleComponents.length > 1;
  }

  private computeVisibleComponents(): void {
    if (!this.food?.components) {
      this.visibleComponents = [];
      return;
    }
    this.visibleComponents = this.food.components.filter((component: any) => !component.isRemoved);
  }

  trackByComponent(index: number, component: any): string {
    return component.id || index.toString();
  }

  // Event handlers - delegate to parent
  onToggleFoodExpansion(): void {
    this.actionRequested.emit({ action: 'toggleFoodExpansion', payload: this.foodIndex });
  }

  onQuantityChange(quantity: number): void {
    this.actionRequested.emit({ action: 'quantityChanged', payload: { foodIndex: this.foodIndex, quantity } });
  }

  onRemoveFood(): void {
    this.actionRequested.emit({ action: 'removeFood', payload: this.food.id || '' });
  }

  // Component-level event handlers
  onToggleComponentExpansion(componentId: string): void {
    this.actionRequested.emit({ action: 'toggleComponentExpansion', payload: componentId });
  }

  onServingSelected(event: any): void {
    event.foodIndex = this.foodIndex;
    this.actionRequested.emit({
      action: 'servingSelected',
      payload: event
    });
  }

 
  onServingQuantityChanged(event: any): void {
    event.foodIndex = this.foodIndex;
    this.actionRequested.emit({
      action: 'servingQuantityChanged',
      payload: event
    });
  }

  onEditStarted(componentId: string): void {
    this.actionRequested.emit({ action: 'editStarted', payload: componentId });
  }

  onEditCanceled(componentId: string): void {
    this.actionRequested.emit({ action: 'editCanceled', payload: componentId });
  }

  onEditConfirmed(event: {componentId: string, newPhrase: string}): void {
    this.actionRequested.emit({ action: 'editConfirmed', payload: event.componentId });
  }

  onRemoveComponent(componentId: string): void {
    this.actionRequested.emit({ action: 'removeComponent', payload: componentId });
  }

  onMoreOptionsRequested(componentId: string): void {
    this.actionRequested.emit({ action: 'moreOptionsRequested', payload: componentId });
  }

  onFoodSelected(event: {componentId: string, food: any}): void {
    this.actionRequested.emit({ action: 'foodSelected', payload: event });
  }

  onInstantOptionsRequested(componentId: string): void {
    this.actionRequested.emit({ action: 'instantOptionsRequested', payload: { componentId } });
  }
}
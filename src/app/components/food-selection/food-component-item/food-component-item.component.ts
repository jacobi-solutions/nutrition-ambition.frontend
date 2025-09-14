import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonRadioGroup, IonRadio, IonSelect, IonSelectOption, IonIcon, IonGrid, IonRow, IonCol, IonList, IonItem, IonLabel } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { createOutline, chevronUpOutline, chevronDownOutline, trashOutline, send, addCircleOutline, ellipsisHorizontal } from 'ionicons/icons';
import { ComponentMatch, ComponentServing } from 'src/app/services/nutrition-ambition-api.service';
import { ServingQuantityInputComponent } from 'src/app/components/serving-quantity-input.component/serving-quantity-input.component';
import { SearchFoodComponent } from '../search-food/search-food.component';

@Component({
  selector: 'app-food-component-item',
  templateUrl: './food-component-item.component.html',
  styleUrls: ['./food-component-item.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonRadioGroup, IonRadio, IonSelect, IonSelectOption, IonIcon, IonGrid, IonRow, IonCol, IonList, IonItem, IonLabel, ServingQuantityInputComponent, SearchFoodComponent]
})
export class FoodComponentItemComponent implements OnInit, OnChanges {
  @Input() component: any; // Component data from parent
  @Input() componentIndex: number = 0;
  @Input() isReadOnly: boolean = false;
  @Input() isEditMode: boolean = false;

  // Precomputed values for performance
  displayName: string = '';
  isInferred: boolean = false;
  brandName: string = '';
  servingLabel: string = '';
  selectedFood: ComponentMatch | null = null;
  selectedServing: ComponentServing | null = null;
  computedIsNewAddition: boolean = false;

  // Getters for ComponentDisplay flags
  get isExpanded(): boolean {
    return this.component?.component?.isExpanded || false;
  }

  get isEditing(): boolean {
    return this.component?.component?.isEditing || false;
  }

  get editingValue(): string {
    return this.component?.component?.editingValue || '';
  }

  get isSearching(): boolean {
    return this.component?.component?.isSearching || false;
  }

  get showingMoreOptions(): boolean {
    return this.component?.component?.showingMoreOptions || false;
  }

  get loadingMoreOptions(): boolean {
    return this.component?.component?.loadingMoreOptions || false;
  }

  get moreOptions(): ComponentMatch[] {
    return this.component?.component?.moreOptions || [];
  }

  get loadingInstantOptions(): boolean {
    return this.component?.component?.loadingInstantOptions || false;
  }

  // Output events for parent coordination
  @Output() toggleExpansion = new EventEmitter<string>();
  @Output() servingSelected = new EventEmitter<{componentId: string, servingId: string}>();
  @Output() quantityChanged = new EventEmitter<{componentId: string, quantity: number}>();
  @Output() editStarted = new EventEmitter<string>();
  @Output() editCanceled = new EventEmitter<string>();
  @Output() editConfirmed = new EventEmitter<{componentId: string, newPhrase: string}>();
  @Output() removeComponent = new EventEmitter<string>();
  @Output() moreOptionsRequested = new EventEmitter<string>();
  @Output() foodSelected = new EventEmitter<{componentId: string, food: ComponentMatch}>();
  @Output() instantOptionsRequested = new EventEmitter<{componentId: string, searchTerm: string}>();

  constructor(
    private cdr: ChangeDetectorRef
  ) {
    addIcons({ createOutline, chevronUpOutline, chevronDownOutline, trashOutline, send, addCircleOutline, ellipsisHorizontal });
  }

  ngOnInit() {
    this.computeDisplayValues();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['component'] || changes['isExpanded']) {
      this.computeDisplayValues();
      this.cdr.detectChanges();
    }
  }

  // Pass-through methods for now - will be implemented as we extract logic
  onToggleExpansion() {
    this.toggleExpansion.emit(this.component.componentId);
  }

  onServingSelected(servingId: string) {
    this.servingSelected.emit({componentId: this.component.componentId, servingId});
  }

  onQuantityChanged(quantity: number) {
    this.quantityChanged.emit({componentId: this.component.componentId, quantity});
  }

  onEditStarted() {
    this.editStarted.emit(this.component.componentId);
  }

  onEditCanceled() {
    this.editCanceled.emit(this.component.componentId);
  }

  onEditConfirmed(newPhrase: string) {
    this.editConfirmed.emit({componentId: this.component.componentId, newPhrase});
  }

  onRemoveComponent() {
    this.removeComponent.emit(this.component.componentId);
  }

  onMoreOptionsRequested() {
    this.moreOptionsRequested.emit(this.component.componentId);
  }

  onFoodSelected(food: ComponentMatch) {
    this.foodSelected.emit({componentId: this.component.componentId, food});
    // Recompute display values after food selection changes
    this.computeDisplayValues();
  }

  onInstantOptionsRequested(searchTerm: string) {
    this.instantOptionsRequested.emit({componentId: this.component.componentId, searchTerm});
  }

  // Compute all display values when data changes
  private computeDisplayValues(): void {
    this.selectedFood = this.computeSelectedFood();
    this.selectedServing = this.computeSelectedServing();

    // Compute display name
    if (this.selectedFood && (this.selectedFood as any).inferred && (this.selectedFood as any).searchText) {
      this.displayName = (this.selectedFood as any).searchText;
    } else if (this.selectedFood?.displayName) {
      this.displayName = this.selectedFood.displayName;
    } else {
      this.displayName = this.component?.component?.key || '';
    }

    // Compute inferred flag
    this.isInferred = !!(this.selectedFood && (this.selectedFood as any).inferred === true);

    // Compute brand name
    this.brandName = this.selectedFood?.brandName || '';

    // Compute serving label
    if (this.selectedServing) {
      const quantity = this.getDisplayQuantity();
      const unit = this.getDisplayUnit();

      if (quantity && unit) {
        this.servingLabel = `${quantity} ${unit}`;
      } else {
        this.servingLabel = `${this.selectedServing.displayQuantity} ${this.selectedServing.displayUnit}`;
      }
    } else {
      this.servingLabel = '';
    }

    // Compute isNewAddition flag
    const matches = this.getDisplayMatches();
    this.computedIsNewAddition = matches.length > 0 && !!(matches[0] as any).isNewAddition;
  }


  getSelectedFood(): ComponentMatch | null {
    return this.selectedFood;
  }

  private computeSelectedFood(): ComponentMatch | null {
    const matches = this.getDisplayMatches();
    if (!matches.length) return null;

    // Find the match marked as best, or use the first one
    const selected = matches.find(m => (m as any).isBestMatch) || matches[0];
    return selected as ComponentMatch;
  }

  getSelectedServing(): ComponentServing | null {
    return this.selectedServing;
  }

  private computeSelectedServing(): ComponentServing | null {
    if (!this.selectedFood?.servings) return null;

    // Find selected serving - for now, return first serving as default
    const selectedServingId = this.component?.selectedServingId;
    if (selectedServingId) {
      return this.selectedFood.servings.find(s => s.providerServingId === selectedServingId) || this.selectedFood.servings[0];
    }

    return this.selectedFood.servings[0];
  }

  getServingOptions(): ComponentServing[] {
    const food = this.getSelectedFood();
    return food?.servings || [];
  }

  getDisplayQuantity(): number {
    const serving = this.getSelectedServing();
    return serving?.scaledQuantity || serving?.displayQuantity || 1;
  }

  getDisplayUnit(): string {
    const serving = this.getSelectedServing();
    return serving?.scaledUnit || serving?.displayUnit || '';
  }

  getCalories(): number | null {
    const serving = this.getSelectedServing();
    if (!serving?.nutrients) return null;

    const energyKcal = serving.nutrients['energy_kcal'];
    return energyKcal ? Math.round(energyKcal) : null;
  }

  getServingLabelForServing(serving: ComponentServing): string {
    if (!serving) return '';
    return `${serving.displayQuantity} ${serving.displayUnit}`;
  }

  // Expanded functionality methods
  getSelectedFoodId(): string | undefined {
    const food = this.getSelectedFood();
    return food?.providerFoodId;
  }

  getSelectedServingId(): string | undefined {
    const serving = this.getSelectedServing();
    return serving?.providerServingId;
  }

  getDisplayMatches(): ComponentMatch[] {
    return this.component?.component?.matches || [];
  }

  getOriginalPhrase(): string {
    return this.component?.component?.originalPhrase || this.component?.component?.key || '';
  }

  hasEditChanges(): boolean {
    return this.editingValue !== this.getOriginalPhrase();
  }

  isServingSelected(serving: ComponentServing): boolean {
    const selectedId = this.getSelectedServingId();
    return serving.providerServingId === selectedId;
  }

  getEffectiveQuantityForServing(serving: ComponentServing): number {
    return serving.scaledQuantity || serving.displayQuantity || 1;
  }

  getUnitTextForServing(serving: ComponentServing): string {
    return serving.scaledUnit || serving.displayUnit || '';
  }

  // Event handlers for expanded functionality
  // Note: Edit handling is now done by SearchFoodComponent

  onFoodSelectedFromDropdown(foodId: string): void {
    const food = this.getDisplayMatches().find(m => m.providerFoodId === foodId);
    if (food) {
      this.foodSelected.emit({componentId: this.component.componentId, food});
    }
  }

  onDropdownWillOpen(): void {
    this.instantOptionsRequested.emit({componentId: this.component.componentId, searchTerm: ''});
  }

  onMoreOptionSelected(alternative: ComponentMatch): void {
    this.foodSelected.emit({componentId: this.component.componentId, food: alternative});
  }

  onServingSelectedFromRadio(servingId: string): void {
    this.servingSelected.emit({componentId: this.component.componentId, servingId});
    // Recompute display values after serving selection changes
    this.computeDisplayValues();
  }

  onRowClicked(serving: ComponentServing): void {
    if (serving.providerServingId) {
      // Only emit selection change if this serving is not already selected
      // This prevents corrupting the virtual serving ID when clicking quantity inputs
      const isAlreadySelected = this.isServingSelected(serving);
      if (!isAlreadySelected) {
        this.servingSelected.emit({componentId: this.component.componentId, servingId: serving.providerServingId});
        // Recompute display values after serving selection changes
        this.computeDisplayValues();
      }
    }
  }

  onServingQuantityChanged(_serving: ComponentServing, quantity: number): void {
    this.quantityChanged.emit({componentId: this.component.componentId, quantity});
    // Recompute display values to update serving label in main card
    this.computeDisplayValues();
  }

  // TrackBy functions
  trackByServingId(index: number, serving: ComponentServing): string {
    return serving.providerServingId || index.toString();
  }

  // Get current edited phrase value
  getCurrentEditedPhrase(): string {
    return this.component?.component?.editingValue || this.getOriginalPhrase();
  }

  getMacroSummary(): string {
    const serving = this.getSelectedServing();
    if (!serving?.nutrients) return '';

    const calories = this.getMacro(serving.nutrients, ['calories', 'Calories', 'energy_kcal', 'Energy']);
    const protein = this.getMacro(serving.nutrients, ['protein', 'Protein']);
    const fat = this.getMacro(serving.nutrients, ['fat', 'Fat', 'total_fat']);
    const carbs = this.getMacro(serving.nutrients, ['carbohydrate', 'Carbohydrate', 'carbohydrates', 'carbs']);

    // Only show if we have at least calories
    if (calories === null) return '';

    const parts = [];
    if (calories !== null) parts.push(`${Math.round(calories)} cal`);

    // Only add other macros if they exist (branded foods may only have calories)
    if (protein !== null) parts.push(`${Math.round(protein)} protein`);
    if (fat !== null) parts.push(`${Math.round(fat)} fat`);
    if (carbs !== null) parts.push(`${Math.round(carbs)} carbs`);

    return `(${parts.join(', ')})`;
  }

  private getMacro(nutrients: { [key: string]: number } | undefined, keys: string[]): number | null {
    if (!nutrients) return null;
    for (const key of keys) {
      if (typeof nutrients[key] === 'number') {
        // Scale by the serving quantity to get the actual macro amount
        const serving = this.getSelectedServing();
        const scaledQuantity = serving?.scaledQuantity || 1;
        return nutrients[key] * scaledQuantity;
      }
    }
    return null;
  }

  // Debug helper
  getObjectKeys(obj: any): string {
    return obj ? Object.keys(obj).join(', ') : 'null';
  }
}
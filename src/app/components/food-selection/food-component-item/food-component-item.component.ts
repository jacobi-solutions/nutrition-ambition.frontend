import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, ChangeDetectionStrategy, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonRadioGroup, IonRadio, IonIcon, IonGrid, IonRow, IonCol, IonList, IonItem, IonLabel } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { createOutline, chevronUpOutline, chevronDownOutline, trashOutline, send, addCircleOutline, ellipsisHorizontal } from 'ionicons/icons';
import { ComponentMatch, ComponentServing } from 'src/app/services/nutrition-ambition-api.service';
import { ServingQuantityInputComponent } from 'src/app/components/food-selection/serving-quantity-input.component/serving-quantity-input.component';
import { ComponentServingDisplay } from 'src/app/models/food-selection-display';
import { ServingIdentifierUtil, NutrientScalingUtil } from '../food-selection.util';
import { AutocompleteComponent } from '../../autocomplete/autocomplete.component';

@Component({
  selector: 'app-food-component-item',
  templateUrl: './food-component-item.component.html',
  styleUrls: ['./food-component-item.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonRadioGroup, IonRadio, IonIcon, IonGrid, IonRow, IonCol, IonList, IonItem, IonLabel, ServingQuantityInputComponent, AutocompleteComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FoodComponentItemComponent implements OnInit, OnChanges {
  @Input() component: any; // Component data from parent
  @Input() componentIndex: number = 0;
  @Input() isReadOnly: boolean = false;

  @ViewChild(AutocompleteComponent) autocomplete!: AutocompleteComponent;
  @Input() isEditMode: boolean = false;
  @Input() isSingleComponentFood: boolean = false;
  @Input() parentQuantity: number = 1;

  // Precomputed values for performance
  displayName: string = '';
  isInferred: boolean = false;
  brandName: string = '';
  servingLabel: string = '';
  selectedFood: ComponentMatch | null = null;
  selectedServing: ComponentServingDisplay | null = null;
  computedIsNewAddition: boolean = false;
  macroSummary: string = '';
  photoThumb: string = '';
  photoHighRes: string = '';
  servingIsPending: boolean = false;
  servingStatusText: string = 'Finding serving size';
  macroStatusText: string = 'Finding nutritional info';

  // Flag to track if user explicitly selected something vs just searching
  private isExplicitSelection = false;

  // Additional precomputed values
  originalPhrase: string = '';
  selectedFoodId: string = '';
  selectedServingId: string = '';
  displayMatches: ComponentMatch[] = [];
  servingOptions: ComponentServingDisplay[] = [];
  moreOptions: ComponentMatch[] = [];

  // Precomputed ComponentDisplay flags
  isExpanded: boolean = false;
  isEditing: boolean = false;
  editingValue: string = '';
  isSearching: boolean = false;
  showingMoreOptions: boolean = false;
  loadingMoreOptions: boolean = false;
  loadingInstantOptions: boolean = false;
  isHydratingSelection: boolean = false;

  // Output events for parent coordination
  @Output() toggleExpansion = new EventEmitter<string>();
  @Output() servingSelected = new EventEmitter<{componentId: string, servingId: string}>();
  @Output() servingQuantityChanged = new EventEmitter<{componentId: string, servingId: string, quantity: number}>();
  @Output() editConfirmed = new EventEmitter<{componentId: string, newPhrase: string}>();
  @Output() removeComponent = new EventEmitter<{componentId: string}>();
  @Output() moreOptionsRequested = new EventEmitter<string>();
  @Output() foodSelected = new EventEmitter<{componentId: string, food: ComponentMatch}>();
  @Output() instantOptionsRequested = new EventEmitter<{componentId: string, searchTerm: string}>();

  constructor(private cdr: ChangeDetectorRef) {
    addIcons({ createOutline, chevronUpOutline, chevronDownOutline, trashOutline, send, addCircleOutline, ellipsisHorizontal });
  }

  ngOnInit() {
    this.computeDisplayValues();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['component'] || changes['isExpanded']) {
      this.computeDisplayValues();
    }
  }

  // Pass-through methods for now - will be implemented as we extract logic
  onToggleExpansion() {
    this.toggleExpansion.emit(this.component.id);
  }

  onServingSelected(servingId: string) {
    this.servingSelected.emit({componentId: this.component.id, servingId});
  }


  onEditStarted() {
    this.isEditing = true;
  }

  onEditCanceled() {
    this.isEditing = false;
  }

  onEditConfirmed(newPhrase: string) {
    this.isEditing = false;
    this.isSearching = true;
    this.editConfirmed.emit({componentId: this.component.id, newPhrase});
  }

  onRemoveComponent() {
    this.removeComponent.emit({ componentId: this.component.id });
  }

  onMoreOptionsRequested() {
    this.moreOptionsRequested.emit(this.component.id);
  }

  onFoodSelected(food: ComponentMatch) {
    this.foodSelected.emit({componentId: this.component.id, food});
    // Recompute display values after food selection changes
    this.computeDisplayValues();
  }

  onInstantOptionsRequested(searchTerm: string) {
    this.instantOptionsRequested.emit({componentId: this.component.id, searchTerm});
  }

  onFoodSearchChange(searchTerm: string) {
    // Mark this as just a search, not an explicit selection
    this.isExplicitSelection = false;
    // Trigger instant options search when user types in autocomplete
    this.instantOptionsRequested.emit({componentId: this.component.id, searchTerm});
  }

  onFoodSelectedFromAutocomplete(selectedItem: ComponentMatch | ComponentMatch[] | null) {
    if (selectedItem && !Array.isArray(selectedItem)) {
      // Mark this as an explicit user selection
      this.isExplicitSelection = true;

      // Immediately update displayName to ensure autocomplete shows selected food name
      this.displayName = selectedItem.displayName || '';

      // Trigger change detection so the [initialSearchText]="displayName" binding updates
      this.cdr.detectChanges();

      this.foodSelected.emit({componentId: this.component.id, food: selectedItem});

      // Force update display values to refresh autocomplete display
      // This is needed because the parent component updates selectedFood but
      // the autocomplete doesn't immediately reflect the change
      setTimeout(() => {
        this.computeDisplayValues();
      }, 0);
    }
  }

  // Compute all display values when data changes
  private computeDisplayValues(): void {
    // Always update selectedFood to pick up new serving data from streaming updates
    // Only skip during active search to avoid disrupting autocomplete
    if (this.isExplicitSelection || !this.selectedFood || !this.isSearching) {
      this.selectedFood = this.computeSelectedFood();
    }
    this.selectedServing = this.computeSelectedServing();

    // Compute display name
    if (this.selectedFood && (this.selectedFood as any).inferred && (this.selectedFood as any).searchText) {
      this.displayName = (this.selectedFood as any).searchText;
    } else if (this.selectedFood?.displayName) {
      this.displayName = this.selectedFood.displayName;
    } else {
      this.displayName = this.component?.key || '';
    }

    // Compute inferred flag
    this.isInferred = !!(this.selectedFood && (this.selectedFood as any).inferred === true);

    // Compute brand name
    this.brandName = this.selectedFood?.brandName || '';

    // Compute photo URLs
    this.photoThumb = this.selectedFood?.photoThumb || '';
    this.photoHighRes = this.selectedFood?.photoHighRes || '';

    // Compute serving label
    if (this.selectedServing) {
      let quantity = this.getDisplayQuantity();
      const unit = this.getDisplayUnit();

      // For single-component foods, multiply by parent quantity
      if (this.isSingleComponentFood && this.parentQuantity > 1) {
        quantity = quantity * this.parentQuantity;
      }

      if (quantity && unit) {
        this.servingLabel = `${Math.round(quantity * 100) / 100} ${unit}`;
      } else {
        const baseQuantity = this.selectedServing.baseQuantity || 1;
        // For single-component foods, multiply by parent quantity if needed
        // Calculate display quantity and use proper singular/plural units
        const displayQuantity = baseQuantity * (this.selectedServing.aiRecommendedScaleNumerator || 1) / (this.selectedServing.aiRecommendedScaleDenominator || 1);
        const unitText = displayQuantity === 1 && this.selectedServing.singularUnit
          ? this.selectedServing.singularUnit
          : (this.selectedServing.pluralUnit || this.selectedServing.baseUnit || '');
        this.servingLabel = `${Math.round(displayQuantity * 100) / 100} ${unitText}`;
      }
    } else {
      this.servingLabel = '';
    }


    // Check if serving is pending (for streaming UI)
    // A serving is considered pending if:
    // 1. It has isPending = true, OR
    // 2. It lacks actual serving data (baseQuantity, measurementDescription, nutrients)
    // Trust the backend's isPending flag first - if it's explicitly false, serving is complete
    // Only fall back to checking for serving data if isPending is not explicitly set
    const backendIsPending = this.selectedServing?.isPending;
    if (backendIsPending === false) {
      // Backend explicitly says not pending - trust it
      this.servingIsPending = false;
    } else {
      // Backend says pending OR didn't set flag - check if we have serving data
      const hasServingData = this.selectedServing &&
                            (this.selectedServing.baseQuantity || 0) > 0 &&
                            (this.selectedServing.measurementDescription || this.selectedServing.baseUnit);
      this.servingIsPending = (backendIsPending || false) || !hasServingData;
    }

    // Extract status text from component or serving
    if (this.servingIsPending) {
      // Check for StatusText on serving first, then component, then default to 'Analyzing'
      this.servingStatusText = (this.selectedServing as any)?.statusText ||
                               (this.component as any)?.statusText ||
                               'Analyzing';
      this.macroStatusText = "(?? cal, ?? protein, ?? fat, ?? carbs)" //"(this.selectedServing as any)?.statusText || '';

      // Diagnostic logging: Show backend status vs displayed status
      const backendServingStatus = (this.selectedServing as any)?.statusText;
      const backendComponentStatus = (this.component as any)?.statusText;
      console.log('[STATUS]',
                  'Component:', this.component?.id?.substring(0, 8),
                  '| Backend Serving:', backendServingStatus || 'none',
                  '| Backend Component:', backendComponentStatus || 'none',
                  '| Displayed:', this.servingStatusText,
                  '| isPending:', this.servingIsPending);
    }

    // Compute macro summary
    this.macroSummary = this.computeMacroSummary();

    // Compute ComponentDisplay flags
    this.isExpanded = this.component?.isExpanded || false;
    this.isEditing = this.component?.isEditing || false;
    this.editingValue = this.component?.editingValue || '';
    this.isSearching = this.component?.isSearching || false;
    this.showingMoreOptions = this.component?.showingMoreOptions || false;
    this.loadingMoreOptions = this.component?.loadingMoreOptions || false;
    this.loadingInstantOptions = this.component?.loadingInstantOptions || false;
    this.isHydratingSelection = this.component?.isHydratingAlternateSelection || false;

    // Compute additional precomputed values
    this.originalPhrase = this.computeOriginalPhrase();
    this.selectedFoodId = this.computeSelectedFoodId();
    this.selectedServingId = this.computeSelectedServingId();
    this.displayMatches = this.computeDisplayMatches();
    this.servingOptions = this.computeServingOptions();
    this.moreOptions = this.component?.moreOptions || [];
  }

  private computeOriginalPhrase(): string {
    // First try to get the original text from the selected food match
    if (this.selectedFood && (this.selectedFood as any).originalText) {
      return (this.selectedFood as any).originalText;
    }

    // Then try searchText for inferred foods
    if (this.selectedFood && (this.selectedFood as any).inferred && (this.selectedFood as any).searchText) {
      return (this.selectedFood as any).searchText;
    }

    // Look for OriginalPhrase at the food level (from backend Food model)
    if (this.component?.originalPhrase) {
      return this.component.component.originalPhrase;
    }

    // Fallback to component key
    return this.component?.key || '';
  }

  private computeSelectedFoodId(): string {
    return this.selectedFood?.providerFoodId || '';
  }

  private computeSelectedServingId(): string {
    return this.selectedServing?.id || '';
  }

  private computeDisplayMatches(): ComponentMatch[] {
    return this.component?.matches || [];
  }

  private computeServingOptions(): ComponentServingDisplay[] {
    const servings = this.selectedFood?.servings || [];
    const selectedServingId = this.selectedServing?.id || '';

    // Create ComponentServingDisplay objects with proper UI state
    return servings.map(serving => {
      const servingId = serving.id || '';
      const effectiveQuantity = Math.round(((serving as any).effectiveQuantity ||
        ((serving.baseQuantity || 1) * (serving.aiRecommendedScaleNumerator || 1) / (serving.aiRecommendedScaleDenominator || 1))) * 100) / 100;
      const isSelected = servingId === selectedServingId;

      // Determine unit text for current quantity
      let unitText: string;
      if (effectiveQuantity === 1 && serving.singularUnit) {
        unitText = serving.singularUnit;
      } else if (serving.pluralUnit) {
        unitText = serving.pluralUnit;
      } else {
        unitText = serving.measurementDescription || '';
      }

      // Create new ComponentServingDisplay object
      return new ComponentServingDisplay({
        ...serving,
        effectiveQuantity: effectiveQuantity,
        isSelected: isSelected,
        unitText: unitText,
        servingLabel: `${Math.round(effectiveQuantity * 100) / 100} ${unitText}`,
        userSelectedQuantity: effectiveQuantity,
        servingMultiplier: 1
      });
    });
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

  getSelectedServing(): ComponentServingDisplay | null {
    return this.selectedServing;
  }

  private computeSelectedServing(): ComponentServingDisplay | null {
    if (!this.selectedFood?.servings) return null;

    // Get the selectedServingId from the selected ComponentMatch
    const selectedServingId = this.selectedFood.selectedServingId;
    if (selectedServingId) {
      return this.selectedFood.servings.find(s =>
        ServingIdentifierUtil.areEqual(s.servingId, selectedServingId)
      ) || this.selectedFood.servings[0];
    }

    return this.selectedFood.servings[0];
  }

  // Truncate text to specified length with ellipsis
  private truncateText(text: string, maxLength: number): string {
    if (!text || text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength) + '...';
  }

  getServingOptions(): ComponentServing[] {
    const food = this.getSelectedFood();
    return food?.servings || [];
  }

  getDisplayQuantity(): number {
    const serving = this.getSelectedServing();
    if (!serving) return 1;

    // ComponentServingDisplay always has effectiveQuantity
    const effectiveQuantity = serving.effectiveQuantity || ((serving.baseQuantity || 1) * (serving.aiRecommendedScaleNumerator || 1) / (serving.aiRecommendedScaleDenominator || 1)) || 1;
    return Math.round(effectiveQuantity * 100) / 100; // Round to 2 decimal places
  }

  getDisplayUnit(): string {
    const serving = this.getSelectedServing();
    // Use proper singular/plural unit based on current quantity
    const currentQuantity = this.getDisplayQuantity();
    if (currentQuantity === 1 && serving?.singularUnit) {
      return serving.singularUnit;
    } else if (serving?.pluralUnit) {
      return serving.pluralUnit;
    }
    return serving?.measurementDescription || '';
  }

  getCalories(): number | null {
    const serving = this.getSelectedServing();
    if (!serving) return null;

    // Use the same scaling logic as getMacro
    const scaledNutrients = NutrientScalingUtil.getScaledNutrients(serving, this.getSelectedFood());
    if (!scaledNutrients) return null;

    const calories = scaledNutrients['calories'];
    if (!calories) return null;

    return Math.round(calories);
  }

  getServingLabelForServing(serving: ComponentServing): string {
    if (!serving) return '';

    const baseQuantity = serving.baseQuantity || 1;
    const aiDisplayQuantity = baseQuantity * (serving.aiRecommendedScaleNumerator || 1) / (serving.aiRecommendedScaleDenominator || 1);

    const displayQuantity = aiDisplayQuantity;

    const roundedQuantity = Math.round(displayQuantity * 100) / 100; // Round to 2 decimal places

    // Use proper singular/plural units
    const unitText = roundedQuantity === 1 && serving.singularUnit
      ? serving.singularUnit
      : (serving.pluralUnit || serving.measurementDescription || '');

    return `${roundedQuantity} ${unitText}`;
  }

  // Expanded functionality methods
  getSelectedFoodId(): string | undefined {
    const food = this.getSelectedFood();
    return food?.providerFoodId;
  }

  getSelectedServingId(): string | undefined {
    const serving = this.getSelectedServing();
    return serving?.id;
  }

  getDisplayMatches(): ComponentMatch[] {
    return this.component?.matches || [];
  }

  getOriginalPhrase(): string {
    const selectedFood = this.getSelectedFood();

    // First try to get the original text from the selected food match
    if (selectedFood && (selectedFood as any).originalText) {
      return (selectedFood as any).originalText;
    }

    // Then try searchText for inferred foods
    if (selectedFood && (selectedFood as any).inferred && (selectedFood as any).searchText) {
      return (selectedFood as any).searchText;
    }

    // Look for OriginalPhrase at the food level (from backend Food model)
    if (this.component?.originalPhrase) {
      return this.component.component.originalPhrase;
    }

    // Fallback to component key
    return this.component?.key || '';
  }

  hasEditChanges(): boolean {
    return this.editingValue !== this.getOriginalPhrase();
  }



  // Event handlers for expanded functionality
  // Note: Edit handling is now done by SearchFoodComponent

  onFoodSelectedFromDropdown(foodId: string): void {
    const food = this.getDisplayMatches().find(m => m.providerFoodId === foodId);
    if (food) {
      this.foodSelected.emit({componentId: this.component.id, food});
    }
  }


  onMoreOptionSelected(alternative: ComponentMatch): void {
    this.foodSelected.emit({componentId: this.component.id, food: alternative});
  }

  onServingSelectedFromRadio(servingId: string): void {
    this.servingSelected.emit({componentId: this.component.id, servingId});
    // Recompute display values after serving selection changes
    //this.computeDisplayValues();
  }

  onRowClicked(serving: ComponentServingDisplay): void {
    if (serving.id) {
      // Only emit selection change if this serving is not already selected
      // This prevents corrupting the virtual serving ID when clicking quantity inputs
      const isAlreadySelected = serving.isSelected;
      if (!isAlreadySelected) {
        this.servingSelected.emit({componentId: this.component.id, servingId: serving.id});
        // Recompute display values after serving selection changes
        // this.computeDisplayValues();
      }
    }
  }

  onServingQuantityChanged(serving: ComponentServingDisplay, quantity: number): void {
    const componentId = this.component?.id || '';
    const baseQuantity = serving.baseQuantity || 1;

    // Update the serving object directly
    serving.userSelectedQuantity = quantity;
    serving.servingMultiplier = quantity / baseQuantity;
    serving.effectiveQuantity = quantity;

    // Update unit text for proper singular/plural grammar
    if (quantity === 1 && serving.singularUnit) {
      serving.unitText = serving.singularUnit;
    } else if (serving.pluralUnit) {
      serving.unitText = serving.pluralUnit;
    } else {
      serving.unitText = serving.baseUnit || '';
    }

    // Recompute display values to update serving label and macros
    // this.computeDisplayValues();

    // Notify parent about quantity change so food-level macros can update
    this.servingQuantityChanged.emit({
      componentId,
      servingId: serving.id || '',
      quantity: quantity
    });
  }

  // TrackBy functions
  trackByServingId(index: number, serving: ComponentServingDisplay): string {
    return serving.id || index.toString();
  }

  // Get current edited phrase value
  getCurrentEditedPhrase(): string {
    return this.component?.editingValue || this.getOriginalPhrase();
  }

  private computeMacroSummary(): string {
    const serving = this.getSelectedServing();
    if (!serving?.nutrients) return '';

    const calories = this.getMacro(['calories', 'Calories', 'energy_kcal', 'Energy']);
    const protein = this.getMacro(['protein', 'Protein']);
    const fat = this.getMacro(['fat', 'Fat', 'total_fat']);
    const carbs = this.getMacro(['carbohydrate', 'Carbohydrate', 'carbohydrates', 'carbs']);

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

  private getMacro(keys: string[]): number | null {
    const serving = this.getSelectedServing();
    if (!serving) return null;

    // Get scaled nutrients (handles both full nutrient data and scaling from base serving)
    const scaledNutrients = NutrientScalingUtil.getScaledNutrients(serving, this.getSelectedFood());
    if (!scaledNutrients) return null;

    for (const key of keys) {
      if (typeof scaledNutrients[key] === 'number') {
        return scaledNutrients[key];
      }
    }
    return null;
  }

  // Debug helper
  getObjectKeys(obj: any): string {
    return obj ? Object.keys(obj).join(', ') : 'null';
  }
}
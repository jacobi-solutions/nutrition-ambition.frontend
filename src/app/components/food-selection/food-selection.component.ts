import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonButton, IonRadioGroup, IonRadio, IonSelect, IonSelectOption, IonIcon, IonGrid, IonRow, IonCol, IonList, IonItem, IonLabel } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { createOutline, chevronUpOutline, chevronDownOutline, trashOutline, send, addCircleOutline, ellipsisHorizontal } from 'ionicons/icons';
import { ComponentMatch, ComponentServing, SubmitServingSelectionRequest, UserSelectedServing, SubmitEditServingSelectionRequest, MessageRoleTypes, NutritionAmbitionApiService, SearchFoodPhraseRequest, UserEditOperation, EditFoodSelectionType, LogMealToolResponse, GetInstantAlternativesRequest, GetInstantAlternativesResponse } from 'src/app/services/nutrition-ambition-api.service';
import { ServingQuantityInputComponent } from 'src/app/components/serving-quantity-input.component/serving-quantity-input.component';
import { FoodComponentItemComponent } from 'src/app/components/food-component-item/food-component-item.component';
import { DisplayMessage } from 'src/app/models/display-message';
import { ToastService } from 'src/app/services/toast.service';
import { DateService } from 'src/app/services/date.service';
import { FoodSelectionService } from 'src/app/services/food-selection.service';

@Component({
  selector: 'app-food-selection',
  templateUrl: './food-selection.component.html',
  styleUrls: ['./food-selection.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonButton, IonIcon, IonGrid, IonRow, IonCol, ServingQuantityInputComponent, FoodComponentItemComponent]
})
export class FoodSelectionComponent implements OnInit, OnChanges {
  @Input() message!: DisplayMessage;
  @Input() isEditingPhrase: boolean = false;
  @Output() selectionConfirmed = new EventEmitter<SubmitServingSelectionRequest>();
  @Output() editConfirmed = new EventEmitter<SubmitEditServingSelectionRequest>();
  @Output() cancel = new EventEmitter<void>();
  @Output() updatedMessage = new EventEmitter<DisplayMessage>();
  @Output() phraseEditRequested = new EventEmitter<{originalPhrase: string, newPhrase: string, messageId: string, componentId?: string}>();

  isReadOnly = false;
  isEditMode = false;

  expandedSections: { [componentId: string]: boolean } = {};
  expandedFoods: { [foodIndex: number]: boolean } = {}; // Track food-level expansion
  removedComponents: Set<string> = new Set();
  isSubmitting = false;
  isCanceling = false;
  private cancelTimeout: any = null;
  editingComponents: { [componentId: string]: boolean } = {};
  editingComponentValues: { [componentId: string]: string } = {};
  searchingComponents: { [componentId: string]: boolean } = {};
  
  // Add something functionality
  isAddingFood = false;
  newFoodPhrase = '';
  isSubmittingNewFood = false;

  // Food-level expansion state (for editing quantity and components)
  expandedFoodEditing: { [foodIndex: number]: boolean } = {};
  editingFoodQuantities: { [foodIndex: number]: number } = {};

  // Track edit operations for the new backend structure
  editOperations: UserEditOperation[] = [];
  removedFoods: Set<string> = new Set(); // Track foods removed via RemoveFood operation
  
  // Track which component was being edited to re-expand it after update
  private editingComponentId: string | null = null;

  // More Options functionality for common foods
  showingMoreOptionsFor: { [componentId: string]: boolean } = {};
  loadingMoreOptionsFor: { [componentId: string]: boolean } = {};
  moreOptionsFor: { [componentId: string]: ComponentMatch[] } = {};
  
  // Dropdown instant search state
  loadingInstantOptionsFor: { [componentId: string]: boolean } = {};

  // Hot-path caches to avoid repeated deep scans
  private componentById: Map<string, any> = new Map();
  private foodForComponentId: Map<string, any> = new Map();
  private selectedFoodByComponentId: Map<string, ComponentMatch> = new Map();
  private selectedServingIdByComponentId: Map<string, string> = new Map();
  
  // Precomputed display values for performance (avoid method calls in templates)
  private computedServingLabels = new Map<string, string>();
  private computedCalories = new Map<string, number | null>();
  private computedDisplayQuantities = new Map<string, number>();
  private computedDisplayUnits = new Map<string, string>();
  private computedSelectedFoodIds = new Map<string, string>();
  private computedBrandNames = new Map<string, string>();
  private computedDualServingOptions = new Map<string, ComponentServing[]>();
  private computedSelectedServingIds = new Map<string, string>();
  private computedServingLabelsByServing = new Map<string, Map<string, string>>(); // componentId -> servingId -> label
  private computedUnitTexts = new Map<string, Map<string, string>>(); // componentId -> servingId -> unitText
  private computedEffectiveQuantities = new Map<string, Map<string, number>>(); // componentId -> servingId -> quantity
  
  // Component state precomputed values
  private computedDisplayNames = new Map<string, string>(); // componentId -> display name
  private computedIsInferred = new Map<string, boolean>(); // componentId -> is inferred
  private computedIsExpanded = new Map<string, boolean>(); // componentId -> is expanded
  private computedIsSearching = new Map<string, boolean>(); // componentId -> is searching
  private computedIsComponentEditing = new Map<string, boolean>(); // componentId -> is editing
  private computedEditingValues = new Map<string, string>(); // componentId -> editing value
  private computedHasChanges = new Map<string, boolean>(); // componentId -> has changes
  private computedIsServingSelected = new Map<string, Map<string, boolean>>(); // componentId -> servingId -> is selected
  
  // Food level precomputed values
  private computedFoodNames = new Map<number, string>(); // foodIndex -> food name
  private computedIsFoodEditingExpanded = new Map<number, boolean>(); // foodIndex -> is expanded

  constructor(
    private toastService: ToastService, 
    private cdr: ChangeDetectorRef,
    private apiService: NutritionAmbitionApiService,
    private dateService: DateService,
    private foodSelectionService: FoodSelectionService
  ) {
    addIcons({ createOutline, chevronUpOutline, chevronDownOutline, trashOutline, send, addCircleOutline, ellipsisHorizontal });
  }

  get hasPayload(): boolean {
    return !!this.message.logMealToolResponse?.foods && this.message.logMealToolResponse.foods.length > 0;
  }

  get statusText(): string {
    const mealName = this.message.mealName && this.message.mealName.trim().length > 0 ? this.message.mealName : 'Food';
    const capitalizedMealName = mealName.charAt(0).toUpperCase() + mealName.slice(1).toLowerCase();
    
    if (this.message.role === MessageRoleTypes.CompletedEditFoodSelection) {
      return `${capitalizedMealName} edited`;
    }
    return `${capitalizedMealName} logged`;
  }

  ngOnInit(): void {
    this.isReadOnly = this.message.role === MessageRoleTypes.CompletedFoodSelection || this.message.role === MessageRoleTypes.CompletedEditFoodSelection;
    this.isEditMode = this.message.role === MessageRoleTypes.PendingEditFoodSelection;
    this.rebuildLookupCaches();
    this.initializeComputedValues();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['message'] && changes['message'].currentValue) {
      // Update readonly state when message role changes
      const newReadOnlyState = this.message.role === MessageRoleTypes.CompletedFoodSelection || this.message.role === MessageRoleTypes.CompletedEditFoodSelection;
      if (newReadOnlyState !== this.isReadOnly) {
        this.isReadOnly = newReadOnlyState;
        if (this.isReadOnly) {
          this.isSubmitting = false;
          this.isCanceling = false;
        }
      }
      this.rebuildLookupCaches();
    }
    if (changes['isReadOnly'] && this.isReadOnly) this.isSubmitting = false;
  }



  toggleExpansion(componentId: string): void {
    this.expandedSections[componentId] = !this.expandedSections[componentId];
    // Update computed value
    this.computedIsExpanded.set(componentId, this.isExpanded(componentId));
  }

  isExpanded(componentId: string): boolean {
    return !!this.expandedSections[componentId];
  }

  // Food-level expansion methods
  toggleFoodExpansion(foodIndex: number): void {
    this.expandedFoods[foodIndex] = !this.expandedFoods[foodIndex];
  }

  isFoodExpanded(foodIndex: number): boolean {
    return !!this.expandedFoods[foodIndex];
  }

  // Get components for a specific food
  getComponentsForFood(food: any): Array<{componentId: string, component: any}> {
    if (!food?.components) return [];
    
    // Return empty if the food has been removed
    if (food.id && this.removedFoods.has(food.id)) {
      return [];
    }
    
    // Filter out removed components
    return food.components
      .filter((component: any) => component.id && !this.removedComponents.has(component.id))
      .map((component: any) => ({ componentId: component.id, component }));
  }

  // All remaining components across foods (excludes removed foods/components)
  get availableComponents(): Array<{componentId: string, component: any}> {
    if (!this.message?.logMealToolResponse?.foods) return [];
    const result: Array<{componentId: string, component: any}> = [];
    for (const food of this.message.logMealToolResponse.foods) {
      const comps = this.getComponentsForFood(food);
      for (const c of comps) result.push(c);
    }
    return result;
  }

  // Calculate total macros for a food (sum of all its components)
  getFoodTotalCalories(food: any): number {
    const componentTotal = this.getComponentsForFood(food).reduce((total, { componentId }) => {
      const selectedServing = this.getSelectedServing(componentId);
      const calories = this.caloriesForServing(selectedServing);
      return total + (calories || 0);
    }, 0);
    return componentTotal * (food.quantity || 1);
  }

  getFoodTotalProtein(food: any): number {
    const componentTotal = this.getComponentsForFood(food).reduce((total, { componentId }) => {
      const selectedServing = this.getSelectedServing(componentId);
      const protein = this.proteinForServing(selectedServing);
      return total + (protein || 0);
    }, 0);
    return componentTotal * (food.quantity || 1);
  }

  getFoodTotalFat(food: any): number {
    const componentTotal = this.getComponentsForFood(food).reduce((total, { componentId }) => {
      const selectedServing = this.getSelectedServing(componentId);
      const fat = this.fatForServing(selectedServing);
      return total + (fat || 0);
    }, 0);
    return componentTotal * (food.quantity || 1);
  }

  getFoodTotalCarbs(food: any): number {
    const componentTotal = this.getComponentsForFood(food).reduce((total, { componentId }) => {
      const selectedServing = this.getSelectedServing(componentId);
      const carbs = this.carbsForServing(selectedServing);
      return total + (carbs || 0);
    }, 0);
    return componentTotal * (food.quantity || 1);
  }

  // Optimized totals using pre-calculated components (passed from template)
  getFoodTotalCaloriesFromComponents(food: any, foodComponents: Array<{componentId: string, component: any}>): number {
    const componentTotal = foodComponents.reduce((total, { componentId }) => {
      const selectedServing = this.getSelectedServing(componentId);
      const calories = this.caloriesForServing(selectedServing);
      return total + (calories || 0);
    }, 0);
    return componentTotal * (food.quantity || 1);
  }

  getFoodTotalProteinFromComponents(food: any, foodComponents: Array<{componentId: string, component: any}>): number {
    const componentTotal = foodComponents.reduce((total, { componentId }) => {
      const selectedServing = this.getSelectedServing(componentId);
      const protein = this.proteinForServing(selectedServing);
      return total + (protein || 0);
    }, 0);
    return componentTotal * (food.quantity || 1);
  }

  getFoodTotalFatFromComponents(food: any, foodComponents: Array<{componentId: string, component: any}>): number {
    const componentTotal = foodComponents.reduce((total, { componentId }) => {
      const selectedServing = this.getSelectedServing(componentId);
      const fat = this.fatForServing(selectedServing);
      return total + (fat || 0);
    }, 0);
    return componentTotal * (food.quantity || 1);
  }

  getFoodTotalCarbsFromComponents(food: any, foodComponents: Array<{componentId: string, component: any}>): number {
    const componentTotal = foodComponents.reduce((total, { componentId }) => {
      const selectedServing = this.getSelectedServing(componentId);
      const carbs = this.carbsForServing(selectedServing);
      return total + (carbs || 0);
    }, 0);
    return componentTotal * (food.quantity || 1);
  }

  // Food-level expansion management
  toggleFoodEditing(foodIndex: number): void {
    this.expandedFoodEditing[foodIndex] = !this.expandedFoodEditing[foodIndex];
    // Update computed value
    this.computedIsFoodEditingExpanded.set(foodIndex, this.isFoodEditingExpanded(foodIndex));
    
    // Initialize quantity editing value if expanding
    if (this.expandedFoodEditing[foodIndex]) {
      const food = this.message.logMealToolResponse?.foods?.[foodIndex];
      if (food) {
        this.editingFoodQuantities[foodIndex] = food.quantity || 1;
      }
    }
  }

  isFoodEditingExpanded(foodIndex: number): boolean {
    // Auto-expand if any component in this food is being edited
    const food = this.message.logMealToolResponse?.foods?.[foodIndex];
    if (food?.components) {
      for (const component of food.components) {
        if (component.matches && component.matches.length > 0 && (component.matches[0] as any).isEditingPhrase) {
          return true;
        }
      }
    }
    
    // Otherwise use manual expansion state
    return !!this.expandedFoodEditing[foodIndex];
  }

  getFoodServingLabel(food: any): string {
    // For multi-component foods, get the serving label from the first component's selected serving
    if (food.components && food.components.length > 0) {
      const firstComponent = food.components[0];
      const selectedServing = this.getSelectedServing(firstComponent.id);
      if (selectedServing) {
        const quantity = selectedServing.displayQuantity || 1;
        const unit = this.getUnitText(selectedServing);
        console.log('getFoodServingLabel debug:', {
          quantity,
          unit,
          selectedServing: {
            displayQuantity: selectedServing.displayQuantity,
            displayUnit: selectedServing.displayUnit,
            description: (selectedServing as any).description
          }
        });
        return `${quantity} ${unit}`;
      }
    }
    
    // Fallback to old logic for single-component foods
    const quantity = food.quantity || 1;
    // Prefer explicit singular/plural from API if provided
    const hasPlural = typeof food.pluralUnit === 'string' && food.pluralUnit.trim().length > 0;
    const hasSingular = typeof food.singularUnit === 'string' && food.singularUnit.trim().length > 0;
    const unitBase = (food.unit || '').trim();

    if (quantity === 1) {
      const label = hasSingular ? (food.singularUnit as string).trim() : (unitBase || 'serving');
      return `1 ${label}`;
    }

    const label = hasPlural ? (food.pluralUnit as string).trim() : (unitBase ? `${unitBase}s` : 'servings');
    return `${quantity} ${label}`;
  }

  getFoodNameWithIngredientCount(food: any): string {
    const componentCount = this.getComponentsForFood(food).length;
    if (componentCount > 1) {
      return `${food.name} - ${componentCount} ingredients`;
    }
    return food.name;
  }

  updateFoodQuantity(foodIndex: number): void {
    const newQuantity = this.editingFoodQuantities[foodIndex];
    if (newQuantity && newQuantity > 0) {
      const food = this.message.logMealToolResponse?.foods?.[foodIndex];
      if (food) {
        // In edit mode, track the operation instead of directly updating
        if (this.isEditMode && food.id) {
          this.addEditOperation(new UserEditOperation({
            action: EditFoodSelectionType.UpdateParentQuantity,
            groupId: food.id,
            newParentQuantity: newQuantity,
            newParentUnit: food.unit || 'serving'
          }));
        } else {
          // In normal mode, update directly for UI display
          food.quantity = newQuantity;
        }
        // Force change detection to update the macro displays
        this.cdr.detectChanges();
      }
    }
  }

  onFoodQuantityChange(foodIndex: number, newQuantity: number): void {
    this.editingFoodQuantities[foodIndex] = newQuantity;
    this.updateFoodQuantity(foodIndex);
  }

  // Add a helper method to manage edit operations
  private addEditOperation(operation: UserEditOperation): void {
    // Remove any existing operation with the same action and target
    if (operation.action === EditFoodSelectionType.UpdateParentQuantity && operation.groupId) {
      this.editOperations = this.editOperations.filter(op => 
        !(op.action === EditFoodSelectionType.UpdateParentQuantity && op.groupId === operation.groupId)
      );
    } else if (operation.action === EditFoodSelectionType.UpdateServing && operation.componentId) {
      this.editOperations = this.editOperations.filter(op => 
        !(op.action === EditFoodSelectionType.UpdateServing && op.componentId === operation.componentId)
      );
    }
    
    this.editOperations.push(operation);
  }

  getSelectedFood(componentId: string): ComponentMatch | null {
    const cached = this.selectedFoodByComponentId.get(componentId);
    if (cached) return cached;
    const component = this.findComponentById(componentId);
    const matches: any[] = component?.matches || [];
    if (!matches.length) return null;
    const selected = (matches.find(m => (m as any).isBestMatch) || matches[0]) as ComponentMatch;
    this.selectedFoodByComponentId.set(componentId, selected);
    const originalSid = (selected as any)?.selectedServingId ?? selected.servings?.[0]?.providerServingId;
    if (originalSid) {
      // Set the original serving ID for backend operations
      (selected as any).selectedServingId = originalSid;
      this.selectedServingIdByComponentId.set(componentId, originalSid);
      
      // Set the user virtual serving ID as default for display
      const userVirtualSid = originalSid + '::user';
      (selected as any).selectedVirtualServingId = userVirtualSid;
    }
    return selected;
  }

  private findComponentById(componentId: string): any {
    return this.componentById.get(componentId) || null;
  }

  private getFoodForComponent(componentId: string): any {
    return this.foodForComponentId.get(componentId) || null;
  }

  private findFoodByComponentId(componentId: string): any {
    if (!this.message.logMealToolResponse?.foods) return null;
    
    for (const food of this.message.logMealToolResponse.foods) {
      if (food.components) {
        for (const component of food.components) {
          if (component.id === componentId) {
            return food;
          }
        }
      }
    }
    return null;
  }

  private findFoodById(foodId: string): any {
    if (!this.message.logMealToolResponse?.foods) return null;
    
    for (const food of this.message.logMealToolResponse.foods) {
      if (food.id === foodId) {
        return food;
      }
    }
    return null;
  }

  onFoodSelected(componentId: string, foodId: string): void {
    // Prevent selection of loading indicator
    if (foodId === 'loading') {
      return;
    }

    const component = this.findComponentById(componentId);
    if (!component?.matches) return;

    // Clear isBestMatch on all matches, then set it on the selected one
    component.matches.forEach((match: any) => {
      (match as any).isBestMatch = match.providerFoodId === foodId;
      if ((match as any).isBestMatch) {
        // Set default serving on the selected match
        (match as any).selectedServingId = match.servings?.[0]?.providerServingId;
        // Set the user virtual serving ID as default for display (preselects user's preferred units)
        const originalSid = match.servings?.[0]?.providerServingId;
        if (originalSid) {
          (match as any).selectedVirtualServingId = originalSid + '::user';
        }
      }
    });

    // In edit mode, track the operation
    if (this.isEditMode) {
      const selectedMatch = component.matches.find((match: any) => match.providerFoodId === foodId);
      this.addEditOperation(new UserEditOperation({
        action: EditFoodSelectionType.UpdateServing,
        componentId: componentId,
        providerFoodId: foodId,
        providerServingId: (selectedMatch as any)?.selectedServingId
      }));
    }

    // Update caches for this component
    const selectedMatch = component.matches.find((match: any) => match.providerFoodId === foodId) as ComponentMatch | undefined;
    if (selectedMatch) {
      this.selectedFoodByComponentId.set(componentId, selectedMatch);
      const sid = (selectedMatch as any)?.selectedServingId ?? selectedMatch.servings?.[0]?.providerServingId;
      if (sid) this.selectedServingIdByComponentId.set(componentId, sid);
      
      // Recompute display values for this component
      this.computeDisplayValues(componentId);
    }
  }

  onServingSelected(componentId: string, servingId: string): void {
    const selectedFood = this.getSelectedFood(componentId);
    if (selectedFood) {
      // Handle virtual serving IDs (::user or ::canonical)
      // Map them back to the original serving ID for backend compatibility
      const originalServingId = servingId.includes('::') 
        ? servingId.split('::')[0] 
        : servingId;

      // Update selectedServingId directly on the selected match
      (selectedFood as any).selectedServingId = originalServingId;

      // Keep cache in sync with the original serving ID
      this.selectedServingIdByComponentId.set(componentId, originalServingId);

      // Store the virtual serving selection for display purposes
      (selectedFood as any).selectedVirtualServingId = servingId;

      // Immediately update the precomputed selection state to ensure UI updates
      this.computeDisplayValues(componentId);

      // In edit mode, track the operation
      if (this.isEditMode) {
        this.addEditOperation(new UserEditOperation({
          action: EditFoodSelectionType.UpdateServing,
          componentId: componentId,
          providerFoodId: (selectedFood as any)?.providerFoodId,
          providerServingId: servingId
        }));
      }
    }
  }

  getSelectedServingId(componentId: string): string | undefined {
    const selectedFood = this.getSelectedFood(componentId);
    if (selectedFood) {
      // Return virtual serving ID for display purposes
      const virtualServingId = (selectedFood as any)?.selectedVirtualServingId;
      console.log('getSelectedServingId:', { componentId, virtualServingId, selectedFood: !!selectedFood });
      if (virtualServingId) return virtualServingId;
    }
    
    // Fallback to original logic for backward compatibility
    const cached = this.selectedServingIdByComponentId.get(componentId);
    if (cached) return cached;
    const firstServingId = (sf: any) => sf?.servings?.[0]?.providerServingId;
    const sid = (selectedFood as any)?.selectedServingId ?? firstServingId(selectedFood);
    if (sid) this.selectedServingIdByComponentId.set(componentId, sid);
    return sid;
  }

  /**
   * Gets the original serving ID (without ::user or ::canonical suffix) for backend operations
   */
  getOriginalServingId(componentId: string): string | undefined {
    const selectedFood = this.getSelectedFood(componentId);
    if (selectedFood) {
      const originalServingId = (selectedFood as any)?.selectedServingId;
      if (originalServingId) return originalServingId;
    }
    
    // Fallback to cached value
    const cached = this.selectedServingIdByComponentId.get(componentId);
    if (cached) return cached;
    
    // Final fallback to first serving
    const firstServingId = (sf: any) => sf?.servings?.[0]?.providerServingId;
    return firstServingId(selectedFood);
  }

  getSelectedServing(componentId: string): ComponentServing | null {
    const food = this.getSelectedFood(componentId);
    const virtualServingId = this.getSelectedServingId(componentId);
    
    console.log('getSelectedServing called:', { componentId, virtualServingId, hasFood: !!food, hasServings: !!food?.servings?.[0] });
    
    if (virtualServingId && food?.servings?.[0]) {
      // Get the dual serving options and find the selected virtual serving
      const dualOptions = this.getDualServingOptions(food.servings[0]);
      const selected = dualOptions.find(s => s.providerServingId === virtualServingId) || null;
      console.log('Found selected serving:', { selected, displayQuantity: selected?.displayQuantity, displayUnit: selected?.displayUnit });
      return selected;
    }
    
    // Fallback to original logic
    const id = this.getOriginalServingId(componentId);
    return food?.servings?.find((s: any) => s?.providerServingId === id) || null;
  }

  // Getter to always derive the selected serving for a food match
  getSelectedServingForFood(match: ComponentMatch): ComponentServing | undefined {
    return match?.servings?.find((s: any) => s?.providerServingId === (match as any)?.selectedServingId);
  }

  // TrackBy function to prevent DOM reuse issues
  trackByServingId(index: number, serving: ComponentServing): string {
    return (serving as any).providerServingId || `${index}`;
  }

  // TrackBy helpers for larger lists
  trackByMeal(index: number, meal: LogMealToolResponse): string {
    // Meal responses may not have stable ids; use mealName + index as stable-enough key
    return (meal as any)?.mealName ? `${(meal as any).mealName}-${index}` : `${index}`;
  }

  trackByFood(index: number, food: any): string {
    return food?.id || `${index}`;
  }

  trackByComponentId(index: number, componentData: { componentId: string }): string {
    return componentData?.componentId || `${index}`;
  }

  isWeightUnit(unit: string | undefined): boolean {
    if (!unit) return false;
    const u = unit.toLowerCase();
    return ['g', 'gram', 'grams', 'ml', 'milliliter', 'milliliters'].includes(u);
  }

  // Macro helpers
  private getMacro(nutrients: { [key: string]: number } | undefined, keys: string[]): number | null {
    if (!nutrients) return null;
    for (const k of keys) if (typeof nutrients[k] === 'number') return nutrients[k];
    return null;
  }
  caloriesForServing(s: ComponentServing | null) {
    return this.scaledMacro(s, ['calories','Calories','energy_kcal','Energy']);
  }
  proteinForServing(s: ComponentServing | null) {
    return this.scaledMacro(s, ['protein','Protein']);
  }
  fatForServing(s: ComponentServing | null) {
    return this.scaledMacro(s, ['fat','Fat','total_fat']);
  }
  carbsForServing(s: ComponentServing | null) {
    return this.scaledMacro(s, ['carbohydrate','Carbohydrate','carbohydrates','carbs']);
  }
  

  isSelectionComplete(): boolean {
    if (!this.hasPayload) return false;
    
    // Check if all non-removed components have valid selections
    if (this.message.logMealToolResponse?.foods) {
      for (const food of this.message.logMealToolResponse.foods) {
        if (food.id && this.removedFoods.has(food.id)) continue;
        
        if (food.components) {
          for (const component of food.components) {
            if (!component.id || this.removedComponents.has(component.id)) continue;
            
            const selectedFood = this.getSelectedFood(component.id);
            const servingId = this.getOriginalServingId(component.id);
            
            if (!(selectedFood as any)?.providerFoodId || !servingId) {
              return false;
            }
          }
        }
      }
    }
    
    return true;
  }

  confirmSelections(): void {
    if (this.isEditMode) {
      this.confirmEditSelections();
    } else {
      this.confirmRegularSelections();
    }
  }

  private confirmRegularSelections(): void {
    const req = new SubmitServingSelectionRequest();
    req.pendingMessageId = this.message.id;
    req.selections = [];

    // Iterate through all foods and components directly
    if (this.message.logMealToolResponse?.foods) {
      for (const food of this.message.logMealToolResponse.foods) {
        if (food.id && this.removedFoods.has(food.id)) continue;
        
        if (food.components) {
          for (const component of food.components) {
            if (!component.id || this.removedComponents.has(component.id)) continue;
            
            const selectedFood = this.getSelectedFood(component.id);
            const servingId = this.getOriginalServingId(component.id);
            const selectedServing = this.getSelectedServing(component.id);
            
            if ((selectedFood as any)?.providerFoodId && servingId && selectedServing) {
              const displayQuantity = this.getEffectiveQuantity(component.id, selectedServing);
              // Use the frontend's calculated scaling - it's already correct!
              const scaledQuantity = selectedServing?.scaledQuantity;
              
              req.selections.push(new UserSelectedServing({
                componentId: component.id,
                originalText: (((component as any)?.key) ?? (selectedFood as any)?.originalText) || '',
                provider: (selectedFood as any)?.provider ?? 'nutritionix',
                providerFoodId: (selectedFood as any)?.providerFoodId,
                providerServingId: servingId,
                editedQuantity: displayQuantity,
                scaledQuantity: scaledQuantity
              }));
            }
          }
        }
      }
    }

    this.isSubmitting = true;
    this.selectionConfirmed.emit(req);
  }

  private confirmEditSelections(): void {
    const req = new SubmitEditServingSelectionRequest();
    req.pendingMessageId = this.message.id || '';
    req.foodEntryId = this.message.logMealToolResponse?.foodEntryId ?? '';
    req.groupId = this.message.logMealToolResponse?.groupId ?? '';
    req.itemSetId = this.message.logMealToolResponse?.itemSetId ?? '';
    req.localDateKey = this.dateService.getSelectedDate() || undefined;
    req.operations = [...this.editOperations]; // Use the tracked edit operations
  
    this.isSubmitting = true;
    this.editConfirmed.emit(req);
  }
  
  // Format a number nicely for UI (0, 1, 1.5, 1.33, 473.2, etc.)


  // Build the user-facing label for a serving row - prioritize UI fields
  getServingLabel(s: ComponentServing | null): string {
    if (!s) return '';
  
    // Always prioritize displayQuantity/displayUnit for UI display
    const dq = s.displayQuantity;
    const du = s.displayUnit;
    if (dq !== undefined && du && du.trim()) {
      return `${this.formatQuantity(dq)} ${du}`.trim();
    }
  
    // Only fall back to description if displayUnit is missing
    if (s.description && s.description.trim()) {
      return s.description;
    }
  
    // Last resort fallback to scaledQuantity/scaledUnit only if both displayUnit and description are empty
    const sq = s.scaledQuantity;
    const su = s.scaledUnit;
    if (sq !== undefined && su && su.trim()) {
      return `${this.fmt(sq)} ${su}`;
    }
  
    return 'serving';
  }

  getDisplayQuantity(s: ComponentServing | null): number {
    if (!s) return 1;
    
    // Always prioritize displayQuantity for stepper input
    const dq = s.displayQuantity;
    if (dq !== undefined && isFinite(dq) && dq > 0) return dq;
    
    // Fall back to scaledQuantity only if displayQuantity is not available
    const sq = s.scaledQuantity;
    if (sq !== undefined && isFinite(sq) && sq > 0) return sq;
    
    return 1;
  }

  getEffectiveQuantity(componentId: string, serving: ComponentServing | null): number {
    // Always prioritize the serving's displayQuantity for UI display
    // This ensures the stepper shows the correct UI value (e.g., 0.42 cup instead of 100)
    if (serving && serving.displayQuantity !== undefined && isFinite(serving.displayQuantity) && serving.displayQuantity > 0) {
      return serving.displayQuantity;
    }
    
    // Fall back to food's effectiveQuantity only if serving's displayQuantity is not available
    const food = this.getSelectedFood(componentId);
    if (food && (food as any).effectiveQuantity && (food as any).effectiveQuantity > 0) {
      return (food as any).effectiveQuantity;
    }
    
    return this.getDisplayQuantity(serving);
  }

  getDisplayNameOrSearchText(componentId: string): string {
    const food = this.getSelectedFood(componentId);
    if (food && (food as any).inferred && (food as any).searchText) return (food as any).searchText;
    if (food?.displayName) return food.displayName;

    const comp = this.findComponentById(componentId);
    return comp?.key || '';
  }

  isInferred(componentId: string): boolean {
    const food = this.getSelectedFood(componentId);
    return !!(food && (food as any).inferred === true);
  }

  getSearchTextOnly(componentId: string): string {
    const food = this.getSelectedFood(componentId);
    
    // First try to get the original text from the selected food match
    if (food && (food as any).originalText) {
      return (food as any).originalText;
    }
    
    // Then try searchText for inferred foods
    if (food && (food as any).inferred && (food as any).searchText) {
      return (food as any).searchText;
    }
    
    // Look for OriginalPhrase at the food level (from backend Food model)
    const foodData = this.getFoodForComponent(componentId);
    if (foodData && (foodData as any).originalPhrase) {
      return (foodData as any).originalPhrase;
    }
    
    // Fallback to component key
    const component = this.findComponentById(componentId);
    return component?.key || '';
  }

  /**
   * Creates dual serving options from a single ComponentServing that contains both user and canonical data
   * Returns an array of virtual serving objects for display purposes
   */
  getDualServingOptions(serving: ComponentServing | null): ComponentServing[] {
    if (!serving) return [];

    console.log('getDualServingOptions called with serving:', { 
      displayQuantity: serving.displayQuantity, 
      displayUnit: serving.displayUnit,
      scaledQuantity: serving.scaledQuantity,
      scaledUnit: serving.scaledUnit,
      calories: serving.nutrients?.['calories'] || serving.nutrients?.['Calories'] || serving.nutrients?.['energy_kcal'] || serving.nutrients?.['Energy'],
      metricServingAmount: (serving as any).metricServingAmount,
      metricServingUnit: (serving as any).metricServingUnit,
      allOriginalKeys: Object.keys(serving)
    });

    // Create user-anchored serving (user's exact input) - this should be pre-selected
    const userServing = new ComponentServing({
      ...serving,
      providerServingId: serving.providerServingId + '::user',
      displayQuantity: serving.displayQuantity, // User's exact quantity (e.g., 100)
      displayUnit: serving.displayUnit,         // User's exact unit (e.g., "g")
      description: `${serving.displayQuantity} ${serving.displayUnit}`,
      // Keep the same nutrients and scaling info
      nutrients: serving.nutrients,
      scaledQuantity: serving.scaledQuantity,
      scaledUnit: serving.scaledUnit
    });

    // Create canonical serving (equivalent in canonical unit)
    const canonicalServing = new ComponentServing({
      ...serving,
      providerServingId: serving.providerServingId + '::canonical',
      displayQuantity: serving.scaledQuantity,  // Canonical equivalent quantity (e.g., 0.42)
      displayUnit: serving.scaledUnit,          // Canonical unit (e.g., "cup")
      description: `${serving.scaledQuantity} ${serving.scaledUnit}`,
      // Keep the same nutrients and scaling info
      nutrients: serving.nutrients,
      scaledQuantity: serving.scaledQuantity,
      scaledUnit: serving.scaledUnit
    });

    console.log('Created dual options:', {
      userServing: { displayQuantity: userServing.displayQuantity, displayUnit: userServing.displayUnit },
      canonicalServing: { displayQuantity: canonicalServing.displayQuantity, displayUnit: canonicalServing.displayUnit }
    });

    // Check if both options have the same unit - if so, only show one option
    const userUnit = (userServing.displayUnit || '').trim().toLowerCase();
    const canonicalUnit = (canonicalServing.displayUnit || '').trim().toLowerCase();
    
    if (userUnit === canonicalUnit && userUnit !== '') {
      console.log('Both servings have same unit:', userUnit, '- showing only user serving');
      // Return only the user serving when units are identical
      return [userServing];
    }

    // Return user serving first so it's pre-selected by default
    return [userServing, canonicalServing];
  }

  getUnitText(s: ComponentServing): string {
    // Always prioritize displayUnit for stepper/current label
    const disp = s.displayUnit;
    if (disp && disp.trim().length) return disp.trim();

    // Only fall back to description parsing if displayUnit is empty
    const desc = s.description;
    if (desc && desc.trim().length) {
      const stripped = this.stripLeadingCount(desc);
      if (stripped && stripped.trim()) return stripped.trim();
    }

    // Final fallback to scaledUnit only if displayUnit and description are empty
    const su = s.scaledUnit;
    if (su && su.trim().length) return su.trim();

    return 'serving';
  }

  // Debug method to check if serving is selected
  isServingSelected(componentId: string, serving: ComponentServing): boolean {
    const selectedId = this.getSelectedServingId(componentId);
    const servingId = serving.providerServingId;
    const isSelected = selectedId === servingId;
    console.log('isServingSelected check:', { componentId, selectedId, servingId, isSelected });
    return isSelected;
  }

  // Compute and cache display values for a component
  private computeDisplayValues(componentId: string): void {
    const selectedFood = this.getSelectedFood(componentId);
    const selectedServing = this.getSelectedServing(componentId);
    
    // Compute selected food ID
    this.computedSelectedFoodIds.set(componentId, selectedFood?.providerFoodId || '');
    
    // Compute brand name
    this.computedBrandNames.set(componentId, selectedFood?.brandName || '');
    
    // Compute selected serving ID
    this.computedSelectedServingIds.set(componentId, this.getSelectedServingId(componentId) || '');
    
    // Compute dual serving options
    const dualOptions = this.getDualServingOptions(selectedFood?.servings?.[0] || null);
    this.computedDualServingOptions.set(componentId, dualOptions);
    
    // Compute per-serving values
    const servingLabels = new Map<string, string>();
    const unitTexts = new Map<string, string>();
    const effectiveQuantities = new Map<string, number>();
    
    for (const serving of dualOptions) {
      const servingId = serving.providerServingId;
      if (servingId) {
        servingLabels.set(servingId, this.getServingLabel(serving));
        unitTexts.set(servingId, this.getUnitText(serving));
        effectiveQuantities.set(servingId, this.getEffectiveQuantity(componentId, serving));
      }
    }
    
    this.computedServingLabelsByServing.set(componentId, servingLabels);
    this.computedUnitTexts.set(componentId, unitTexts);
    this.computedEffectiveQuantities.set(componentId, effectiveQuantities);
    
    if (!selectedServing) {
      this.computedServingLabels.set(componentId, '');
      this.computedCalories.set(componentId, null);
      this.computedDisplayQuantities.set(componentId, 0);
      this.computedDisplayUnits.set(componentId, '');
      return;
    }

    // Compute serving label - create a simple label directly from the serving
    const rawQuantity = selectedServing.displayQuantity || 1;
    // Format quantity to remove floating point precision issues and limit decimal places
    const quantity = this.formatQuantity(rawQuantity);
    const unit = this.getUnitText(selectedServing);
    const servingLabel = `${quantity} ${unit}`;
    this.computedServingLabels.set(componentId, servingLabel);

    // Compute calories
    const calories = this.caloriesForServing(selectedServing);
    this.computedCalories.set(componentId, calories);

    // Compute display quantity and unit
    this.computedDisplayQuantities.set(componentId, selectedServing.displayQuantity || 0);
    this.computedDisplayUnits.set(componentId, selectedServing.displayUnit || '');
    
    // Compute component state values
    this.computedDisplayNames.set(componentId, this.getDisplayNameOrSearchText(componentId));
    this.computedIsInferred.set(componentId, this.isInferred(componentId));
    this.computedIsExpanded.set(componentId, this.isExpanded(componentId));
    this.computedIsSearching.set(componentId, this.isSearchingComponent(componentId));
    this.computedIsComponentEditing.set(componentId, this.isComponentBeingEdited(componentId));
    this.computedEditingValues.set(componentId, this.getEditingComponentValue(componentId));
    this.computedHasChanges.set(componentId, this.hasChanges(componentId));
    
    // Compute per-serving selection state
    const servingSelections = new Map<string, boolean>();
    for (const serving of dualOptions) {
      const servingId = serving.providerServingId;
      if (servingId) {
        servingSelections.set(servingId, this.isServingSelected(componentId, serving));
      }
    }
    this.computedIsServingSelected.set(componentId, servingSelections);
  }

  // Get precomputed values (for template use)
  getComputedServingLabel(componentId: string): string {
    return this.computedServingLabels.get(componentId) || '';
  }

  getComputedCalories(componentId: string): number | null {
    return this.computedCalories.get(componentId) || null;
  }

  getComputedDisplayQuantity(componentId: string): number {
    return this.computedDisplayQuantities.get(componentId) || 0;
  }

  getComputedDisplayUnit(componentId: string): string {
    return this.computedDisplayUnits.get(componentId) || '';
  }

  getComputedSelectedFoodId(componentId: string): string {
    return this.computedSelectedFoodIds.get(componentId) || '';
  }

  getComputedBrandName(componentId: string): string {
    return this.computedBrandNames.get(componentId) || '';
  }

  getComputedFoodServingLabel(foodIndex: number): string {
    const food = this.message.logMealToolResponse?.foods?.[foodIndex];
    if (!food) return '';
    
    // For multi-component foods, use the food-level quantity and unit
    if (food.components && food.components.length > 1) {
      const quantity = food.quantity || 1;
      const unit = food.unit || 'serving';
      return `${quantity} ${unit}`;
    }
    
    // For single-component foods, fall back to the first component's serving label
    const foodComponents = this.getComponentsForFood(food);
    if (foodComponents.length > 0) {
      return this.getComputedServingLabel(foodComponents[0].componentId);
    }
    
    return '';
  }

  getComputedDualServingOptions(componentId: string): ComponentServing[] {
    return this.computedDualServingOptions.get(componentId) || [];
  }

  getComputedSelectedServingId(componentId: string): string {
    return this.computedSelectedServingIds.get(componentId) || '';
  }

  getComputedServingLabelForServing(componentId: string, servingId: string): string {
    return this.computedServingLabelsByServing.get(componentId)?.get(servingId) || '';
  }

  getComputedUnitTextForServing(componentId: string, servingId: string): string {
    return this.computedUnitTexts.get(componentId)?.get(servingId) || '';
  }

  getComputedEffectiveQuantityForServing(componentId: string, servingId: string): number {
    return this.computedEffectiveQuantities.get(componentId)?.get(servingId) || 0;
  }

  // Component state getters
  getComputedDisplayName(componentId: string): string {
    return this.computedDisplayNames.get(componentId) || '';
  }

  getComputedIsInferred(componentId: string): boolean {
    return this.computedIsInferred.get(componentId) || false;
  }

  getComputedIsExpanded(componentId: string): boolean {
    return this.computedIsExpanded.get(componentId) || false;
  }

  getComputedIsSearching(componentId: string): boolean {
    return this.computedIsSearching.get(componentId) || false;
  }

  getComputedIsComponentEditing(componentId: string): boolean {
    return this.computedIsComponentEditing.get(componentId) || false;
  }

  getComputedEditingValue(componentId: string): string {
    return this.computedEditingValues.get(componentId) || '';
  }

  getComputedHasChanges(componentId: string): boolean {
    return this.computedHasChanges.get(componentId) || false;
  }

  getComputedIsServingSelected(componentId: string, servingId: string): boolean {
    return this.computedIsServingSelected.get(componentId)?.get(servingId) || false;
  }

  // Food level getters
  getComputedFoodName(foodIndex: number): string {
    return this.computedFoodNames.get(foodIndex) || '';
  }

  getComputedIsFoodEditingExpanded(foodIndex: number): boolean {
    return this.computedIsFoodEditingExpanded.get(foodIndex) || false;
  }

  // Initialize computed values for all components
  private initializeComputedValues(): void {
    const foods = this.message?.logMealToolResponse?.foods || [];
    for (let foodIndex = 0; foodIndex < foods.length; foodIndex++) {
      const food = foods[foodIndex];
      
      // Compute food-level values
      this.computedFoodNames.set(foodIndex, this.getFoodNameWithIngredientCount(food));
      this.computedIsFoodEditingExpanded.set(foodIndex, this.isFoodEditingExpanded(foodIndex));
      
      for (const component of food.components || []) {
        const componentId = component.id;
        if (componentId) {
          this.computeDisplayValues(componentId);
        }
      }
    }
  }
  

  private nf = new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  /**
   * Format quantity to remove floating point precision issues and limit decimal places
   */
  private formatQuantity(value: number): string {
    if (!isFinite(value) || value === 0) return '0';
    
    // Round to 3 decimal places to avoid floating point precision issues
    const rounded = Math.round(value * 1000) / 1000;
    
    // For whole numbers, show no decimals
    if (rounded === Math.floor(rounded)) {
      return rounded.toString();
    }
    
    // For decimals, show up to 2 decimal places, removing trailing zeros
    return rounded.toFixed(2).replace(/\.?0+$/, '');
  }
  
  private fmt(n: number): string {
    if (!isFinite(n)) return '0';
    return this.nf.format(n);
  }
  

  // Scale a macro per 1 serving by the per-row scaledQuantity
  private scaledMacro(s: ComponentServing | null, keys: string[]): number | null {
    if (!s || !s.nutrients) return null;
    const base = this.getMacro(s.nutrients, keys);
    if (base == null) return null;
    const q = Number((s as any).scaledQuantity ?? 1);
    console.log('scaledMacro calculation:', { 
      base, 
      scaledQuantity: q, 
      result: base * q,
      servingId: s.providerServingId,
      keys: keys
    });
    if (!isFinite(q) || q <= 0) return base; // be forgiving; show per-serving
    return base * q;
  }


  async removeItem(componentId: string) {
    const rowElement = document.getElementById(`row-${componentId}`);
    if (rowElement) rowElement.classList.add('removing');

    setTimeout(async () => {
      // In edit mode, track the operation instead of just hiding UI
      if (this.isEditMode) {
        this.addEditOperation(new UserEditOperation({
          action: EditFoodSelectionType.RemoveComponent,
          componentId: componentId
        }));
      }

      this.removedComponents.add(componentId);
      // Evict caches for this component
      this.componentById.delete(componentId);
      this.foodForComponentId.delete(componentId);
      this.selectedFoodByComponentId.delete(componentId);
      this.selectedServingIdByComponentId.delete(componentId);

      // Check if this was the last remaining food item
      const remainingItems = this.availableComponents; // This will exclude the just-removed item
      const isLastItem = remainingItems.length === 0;

      if (isLastItem) {
        // If this was the last item, trigger cancellation instead of showing undo toast
        this.cancelSelection();
        return;
      }

      const component = this.findComponentById(componentId);
      const food = this.getSelectedFood(componentId);
      const itemName = food?.displayName || component?.key || 'item';

      await this.toastService.showToast({
        message: `${itemName} removed`,
        duration: 5000,
        color: 'medium',
        buttons: [
          {
            text: 'Undo',
            handler: () => {
              this.removedComponents.delete(componentId);
              
              // In edit mode, also remove the operation
              if (this.isEditMode) {
                this.editOperations = this.editOperations.filter(op => 
                  !(op.action === EditFoodSelectionType.RemoveComponent && op.componentId === componentId)
                );
              }
            }
          }
        ]
      });
    }, 300);
  }

  async removeFood(foodId: string) {
    const food = this.findFoodById(foodId);
    if (!food) return;

    // In edit mode, track the operation
    if (this.isEditMode) {
      this.addEditOperation(new UserEditOperation({
        action: EditFoodSelectionType.RemoveFood,
        groupId: foodId
      }));
    }

    this.removedFoods.add(foodId);

    // Evict all cached entries for components within this food
    const comps = (food.components || []) as any[];
    for (const c of comps) {
      const cid = c?.id;
      if (!cid) continue;
      this.componentById.delete(cid);
      this.foodForComponentId.delete(cid);
      this.selectedFoodByComponentId.delete(cid);
      this.selectedServingIdByComponentId.delete(cid);
    }

    // Check if this was the last remaining food item
    const remainingItems = this.availableComponents;
    const isLastItem = remainingItems.length === 0;

    if (isLastItem) {
      this.cancelSelection();
      return;
    }

    const foodName = food.name || 'food item';

    await this.toastService.showToast({
      message: `${foodName} removed`,
      duration: 5000,
      color: 'medium',
      buttons: [
        {
          text: 'Undo',
          handler: () => {
            this.removedFoods.delete(foodId);
            
            // In edit mode, also remove the operation
            if (this.isEditMode) {
              this.editOperations = this.editOperations.filter(op => 
                !(op.action === EditFoodSelectionType.RemoveFood && op.groupId === foodId)
              );
            }
          }
        }
      ]
    });
  }

  // Rescaling helper methods
  private num(x: any): number {
    const n = parseFloat(x);
    return isFinite(n) ? n : NaN;
  }

  private getMetricAmt(s: ComponentServing): number {
    return this.num((s as any).metricServingAmount);
  }

  private getMetricUnit(s: ComponentServing): string {
    return String((s as any).metricServingUnit || '').trim();
  }

  private getNumberOfUnits(s: ComponentServing): number {
    const units = this.num((s as any).numberOfUnits ?? 1);
    return isFinite(units) && units > 0 ? units : 1;
  }

  private stripLeadingCount(label: string | undefined): string {
    if (!label) return '';
    // Remove leading digits, fractions, and whitespace (e.g., "2 medium" -> "medium")
    return label.replace(/^\s*[\d¼½¾⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞.,/]*\s*/, '').trim();
  }

  private isMetricRow(s: ComponentServing): boolean {
    const desc = (s as any).description as string | undefined;
    const mu = this.getMetricUnit(s).toLowerCase();
    const md = (s as any).measurementDescription as string | undefined;
    
    // Consider "100 g", "250 ml", or measurementDescription==="g"/"ml" as metric rows
    const looksMetric = !!desc && /^\s*[\d¼½¾⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]/.test(desc) && ['g','ml','l'].includes(mu);
    const mdMetric = (md || '').trim().toLowerCase();
    return looksMetric || mdMetric === 'g' || mdMetric === 'ml';
  }

  private rescaleFromSelected(componentId: string, selected: ComponentServing, editedQty: number): void {
    console.log('rescaleFromSelected called:', { componentId, editedQty, selectedId: selected.providerServingId });
    
    // 0) guard
    const component = this.findComponentById(componentId);
    if (!component) {
      console.log('rescaleFromSelected: no component found');
      return;
    }
    
    // 1) compute targetMass in metric (g/ml)
    const selMetricAmt = this.getMetricAmt(selected); // per "one" serving of selected
    const selIsMetric = this.isMetricRow(selected);
    let targetMass = NaN;
    
    console.log('rescaleFromSelected: initial calculations:', { 
      selMetricAmt, 
      selIsMetric, 
      selectedDisplayUnit: selected.displayUnit,
      selectedDescription: (selected as any).description,
      metricServingAmount: (selected as any).metricServingAmount,
      metricServingUnit: (selected as any).metricServingUnit,
      measurementDescription: (selected as any).measurementDescription,
      allProperties: Object.keys(selected)
    });
    
    if (selIsMetric) {
      // if selected row's unit is already metric, editedQty is the targetMass (e.g., 120 g)
      targetMass = editedQty;
    } else {
      // household/size row: convert to metric via its per-serving metric amount
      // editedQty (e.g., 2 large) * 50 g (metric per 1 large) → 100 g target
      targetMass = editedQty * (isFinite(selMetricAmt) ? selMetricAmt : NaN);
    }
    
    console.log('rescaleFromSelected: targetMass calculated:', targetMass);
    
    if (!isFinite(targetMass) || targetMass <= 0) {
      console.log('rescaleFromSelected: invalid targetMass, returning');
      return;
    }

    // 2) iterate all servings in the selected food and recompute scaledQuantity + display fields
    const selectedFood = this.getSelectedFood(componentId);
    if (!selectedFood?.servings) {
      console.log('rescaleFromSelected: no servings found');
      return;
    }

    // ensure exactly one best match (the edited row)
    const editedId = selected.providerServingId;
    console.log('rescaleFromSelected: processing servings for food:', { 
      servingsCount: selectedFood.servings.length, 
      editedId 
    });

    for (const s of selectedFood.servings) {
      const mAmt = this.getMetricAmt(s);
      const hasMetric = isFinite(mAmt) && mAmt > 0;
      let scaledQ = (s as any).scaledQuantity;
      const originalScaledQ = scaledQ;

      console.log('rescaleFromSelected: processing serving:', {
        servingId: s.providerServingId,
        originalScaledQ,
        mAmt,
        hasMetric,
        targetMass
      });

      if (hasMetric) {
        // math: scaledQuantity = targetMass / metricServingAmount
        scaledQ = targetMass / mAmt;
        if (!isFinite(scaledQ) || scaledQ < 0) scaledQ = 0;
      } else {
        // fallback if no metric amount; keep existing or default to 1
        if (!isFinite(scaledQ) || scaledQ <= 0) scaledQ = 1;
      }

      console.log('rescaleFromSelected: calculated new scaledQ:', scaledQ);

      // Update scaledQuantity used by your macro math
      (s as any).scaledQuantity = scaledQ;

      // Update displayQuantity / displayUnit for the row
      const mu = this.getMetricUnit(s);
      const desc = (s as any).description as string | undefined;
      const md = (s as any).measurementDescription as string | undefined;
      let uiQty = (s as any).displayQuantity;
      let uiUnit = (s as any).displayUnit;

      if (this.isMetricRow(s) && hasMetric && mu) {
        // metric row: uiQuantity = targetMass; uiUnit = metric unit
        uiQty = targetMass;
        uiUnit = mu;
      } else {
        // household/size row: uiQuantity = scaledQuantity * numberOfUnits; uiUnit = stripped desc/md
        const units = this.getNumberOfUnits(s);
        uiQty = scaledQ * (isFinite(units) && units > 0 ? units : 1);
        const label = (desc && desc.trim().length > 0 ? desc : (md || '')).trim();
        uiUnit = this.stripLeadingCount(label) || 'serving';
      }

      // Clamp & assign
      if (!isFinite(uiQty) || uiQty < 0) uiQty = 0;
      (s as any).displayQuantity = uiQty;
      (s as any).displayUnit = (uiUnit || '').trim();

      // mark best match
      (s as any).isBestMatch = (s as any).providerServingId === editedId;
    }

    // ensure UI shows the edited row as selected
    if (editedId) {
      this.onServingSelected(componentId, editedId);
    }
  }

  onInlineQtyChanged(componentId: string, s: ComponentServing, newValue: number): void {
    const servingId = s.providerServingId || '';
    console.log('=== onInlineQtyChanged START ===', { componentId, newValue, servingId });
    console.log('Current selection before change:', this.getSelectedServingId(componentId));
    
    // clamp
    const v = Math.max(0.1, Math.min(999, Number(newValue) || 0));
    (s as any).displayQuantity = v;
    console.log('Updated displayQuantity:', v);

    // Ensure this row is selected and get the correct selection state
    const currentSelected = this.getSelectedServingId(componentId);
    const sid = (s as any).providerServingId;
    
    // If this row isn't selected, select it now and wait for the selection to be processed
    if (currentSelected !== sid && sid) {
      console.log('Switching selection from', currentSelected, 'to', sid);
      this.onServingSelected(componentId, sid);
    }

    // Update the original serving object with the new quantity and scale appropriately
    const currentFood = this.getSelectedFood(componentId);
    if (currentFood?.servings?.[0]) {
      const originalServing = currentFood.servings[0];
      const servingId = (s as any).providerServingId || '';
      
      console.log('onInlineQtyChanged details:', {
        newValue: v,
        servingId,
        isUserServing: servingId.includes('::user'),
        isCanonicalServing: servingId.includes('::canonical'),
        virtualServingUnit: s.displayUnit,
        originalServingUnit: (originalServing as any).displayUnit,
        currentSelectedAfterUpdate: this.getSelectedServingId(componentId)
      });
      
      // Determine which virtual serving is being edited and apply appropriate scaling
      const isEditingPrimaryDisplay = servingId.includes('::user');
      const isEditingEquivalentDisplay = servingId.includes('::canonical');
      
      if (isEditingPrimaryDisplay) {
        // User is editing the primary display quantity (originalServing.displayQuantity)
        const oldPrimaryQuantity = (originalServing as any).displayQuantity || 1;
        const scalingFactor = v / oldPrimaryQuantity;
        
        // Update the primary quantity
        (originalServing as any).displayQuantity = v;
        
        // Proportionally scale the equivalent quantity
        const oldEquivalentQuantity = (originalServing as any).scaledQuantity || 1;
        const newEquivalentQuantity = oldEquivalentQuantity * scalingFactor;
        (originalServing as any).scaledQuantity = newEquivalentQuantity;
        
        console.log('Primary display scaling:', {
          oldPrimaryQuantity,
          newPrimaryQuantity: v,
          scalingFactor,
          oldEquivalentQuantity,
          newEquivalentQuantity
        });
        
      } else if (isEditingEquivalentDisplay) {
        // User is editing the equivalent display quantity (originalServing.scaledQuantity)
        const oldEquivalentQuantity = (originalServing as any).scaledQuantity || 1;
        const scalingFactor = v / oldEquivalentQuantity;
        
        // Update the equivalent quantity
        (originalServing as any).scaledQuantity = v;
        
        // Proportionally scale the primary quantity
        const oldPrimaryQuantity = (originalServing as any).displayQuantity || 1;
        const newPrimaryQuantity = oldPrimaryQuantity * scalingFactor;
        (originalServing as any).displayQuantity = newPrimaryQuantity;
        
        console.log('Equivalent display scaling:', {
          oldEquivalentQuantity,
          newEquivalentQuantity: v,
          scalingFactor,
          oldPrimaryQuantity,
          newPrimaryQuantity
        });
      }
    }

    // Ensure the virtual serving ID is set to what the user is currently editing
    if (currentFood) {
      const originalSid = (currentFood as any)?.selectedServingId;
      if (originalSid) {
        // Set the selection to match the row being edited (servingId already has ::user or ::canonical)
        (currentFood as any).selectedVirtualServingId = servingId;
        console.log('Setting selection to edited row:', servingId);
      }
      
      // Recompute display values AFTER setting the correct selection state
      this.computeDisplayValues(componentId);
    } else {
      // If no currentFood, still try to compute display values
      this.computeDisplayValues(componentId);
    }
    
    console.log('=== onInlineQtyChanged END ===');
    console.log('Final selection after change:', this.getSelectedServingId(componentId));

    // In edit mode, track the operation
    if (this.isEditMode) {
      const selectedFood = this.getSelectedFood(componentId);
      const sid = (s as any).providerServingId;
      if (selectedFood && sid) {
        this.addEditOperation(new UserEditOperation({
          action: EditFoodSelectionType.UpdateServing,
          componentId: componentId,
          providerFoodId: (selectedFood as any)?.providerFoodId,
          providerServingId: sid,
          editedQuantity: v
        }));
      }
    }
    
    // Mark this as the best match
    const selectedFood = this.getSelectedFood(componentId);
    if (selectedFood?.servings) {
      for (const serving of selectedFood.servings) {
        (serving as any).isBestMatch = (serving as any).providerServingId === (s as any).providerServingId;
      }
    }
    
           // Recompute display values for this component
           this.computeDisplayValues(componentId);

           // Force change detection to update the UI immediately
           this.cdr.detectChanges();
  }

  onRowClicked(componentId: string, s: ComponentServing): void {
    const current = this.getSelectedServingId(componentId);
    const sid2 = (s as any).providerServingId;
    if (current !== sid2 && sid2) {
      this.onServingSelected(componentId, sid2);
    }
  }

  async cancelSelection(): Promise<void> {
    console.log('Food selection: cancelSelection() called');
    // Start the canceling state to show thinking dots
    this.isCanceling = true;
    
    // Show toast with undo option
    const toast = await this.toastService.showToast({
      message: 'Food logging canceled',
      duration: 5000,
      color: 'medium',
      buttons: [
        {
          text: 'Undo',
          handler: () => {
            // User clicked undo - stop the cancellation process
            this.isCanceling = false;
            if (this.cancelTimeout) {
              clearTimeout(this.cancelTimeout);
              this.cancelTimeout = null;
            }
            return true; // Close the toast
          }
        }
      ]
    });
    
    // Set a timeout to actually cancel after toast duration
    this.cancelTimeout = setTimeout(() => {
      // Toast expired without undo - proceed with cancellation
      console.log('Food selection: Emitting cancel event after timeout');
      this.cancel.emit();
      this.cancelTimeout = null;
      // Note: isCanceling will be reset by parent when API response comes back
    }, 5000);
    
    // Listen for toast dismissal (if user dismisses manually)
    toast.onDidDismiss().then((result) => {
      // If toast was dismissed but not by undo button, proceed with cancellation
      if (result.role !== 'cancel' && this.isCanceling && this.cancelTimeout) {
        // User dismissed toast manually - proceed with cancellation immediately
        console.log('Food selection: Emitting cancel event after toast dismissal');
        clearTimeout(this.cancelTimeout);
        this.cancel.emit();
        this.cancelTimeout = null;
        // Note: isCanceling will be reset by parent when API response comes back
      }
    });
  }

  async onEditPhrase(componentId: string): Promise<void> {
    const food = this.getSelectedFood(componentId);
    if (!food) return;

    const missingInfo = this.getMissingInformation(food);
    const component = this.findComponentById(componentId);
    const originalText = component?.key || '';
    const suggestionMessage = this.generateSuggestionMessage(originalText, missingInfo);
    
    // Show suggestion as a positioned tooltip above the phrase input
    this.showSuggestionTooltip(componentId, suggestionMessage);
  }

  private showSuggestionTooltip(componentId: string, message: string): void {
    // Remove any existing tooltip
    this.removeSuggestionTooltip();
    
    // Find the specific component container using the data attribute
    const componentContainer = document.querySelector(`[data-component-id="${componentId}"]`) as HTMLElement;
    if (!componentContainer) {
      console.log('Could not find component container for:', componentId);
      return;
    }
    
    // Look for textarea first (edit mode), then phrase text (display mode)
    let targetElement = componentContainer.querySelector('textarea.phrase-input') as HTMLElement;
    if (!targetElement) {
      targetElement = componentContainer.querySelector('.phrase-text') as HTMLElement;
    }
    
    if (!targetElement) {
      console.log('Could not find target element in container for:', componentId);
      return;
    }
    
    // Create tooltip element
    const tooltip = document.createElement('div');
    tooltip.className = 'suggestion-tooltip';
    
    // Make keywords bold in the message
    const boldMessage = this.makeSuggestionKeywordsBold(message);
    
    tooltip.innerHTML = `
      <div class="tooltip-content">
        <p>${boldMessage}</p>
        <button class="tooltip-close" onmousedown="event.preventDefault(); this.parentElement.parentElement.remove();">Got it</button>
      </div>
    `;
    
    // Position tooltip above the target element
    const rect = targetElement.getBoundingClientRect();
    tooltip.style.position = 'fixed';
    tooltip.style.left = `${rect.left}px`;
    tooltip.style.top = `${rect.top - 10}px`;
    tooltip.style.transform = 'translateY(-100%)';
    tooltip.style.zIndex = '10000';
    
    // Add to document
    document.body.appendChild(tooltip);
    
    // Auto-remove after 8 seconds
    setTimeout(() => {
      this.removeSuggestionTooltip();
    }, 4000);
  }
  
  private removeSuggestionTooltip(): void {
    const existingTooltip = document.querySelector('.suggestion-tooltip');
    if (existingTooltip) {
      existingTooltip.remove();
    }
  }

  private makeSuggestionKeywordsBold(message: string): string {
    // List of keywords to make bold
    const keywords = [
      'description',
      'brand name',
      'cooking method',
      'size'
    ];
    
    let boldMessage = message;
    
    // Replace each keyword with bold version
    keywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      boldMessage = boldMessage.replace(regex, `<strong>${keyword}</strong>`);
    });
    
    return boldMessage;
  }

  private getMissingInformation(food: ComponentMatch): string[] {
    const missing: string[] = [];
    
    if (!food.description || food.description.trim() === '') {
      missing.push('description');
    }
    
    if (!food.brandName || food.brandName.trim() === '') {
      missing.push('brand name');
    }
    
    if (!food.cookingMethod || food.cookingMethod.trim() === '') {
      missing.push('cooking method');
    }
    
    if (!food.size || food.size.trim() === '') {
      missing.push('size');
    }
    
    return missing;
  }

  private generateSuggestionMessage(originalPhrase: string, missingInfo: string[]): string {
    if (missingInfo.length === 0) {
      return `Your search looks complete! You can try adding more specific details if you'd like better results.`;
    }

    let suggestion = ``;
    
    if (missingInfo.length === 1) {
      suggestion += `Try adding a ${missingInfo[0]} for better results.`;
    } else if (missingInfo.length === 2) {
      suggestion += `Try adding a ${missingInfo[0]} and/or ${missingInfo[1]} for better results.`;
    } else {
      const lastItem = missingInfo.pop();
      suggestion += `Try adding ${missingInfo.join(', ')}, and/or ${lastItem} for better results.`;
    }
    
    return suggestion;
  }

  isComponentBeingEdited(componentId: string): boolean {
    return !!this.editingComponents[componentId];
  }

  isSearchingComponent(componentId: string): boolean {
    // Check if this component has a ComponentMatch with isEditingPhrase = true
    const component = this.findComponentById(componentId);
    if (component?.matches && component.matches.length > 0 && (component.matches[0] as any).isEditingPhrase) {
      return true;
    }
    // Fallback to local state for compatibility
    return !!this.searchingComponents[componentId];
  }

  clearComponentSearching(componentId: string): void {
    this.searchingComponents[componentId] = false;
    delete this.searchingComponents[componentId];
  }



  onTextareaBlur(componentId: string, event: FocusEvent): void {
    // Check if the focus is moving to the send button
    const relatedTarget = event.relatedTarget as HTMLElement;
    if (relatedTarget && relatedTarget.classList.contains('send-button')) {
      return; // Don't close edit mode
    }
    
    // Use a small delay to allow button click to process first
    setTimeout(() => {
      this.finishEditingComponent(componentId);
    }, 150);
  }

  async startEditingComponent(componentId: string): Promise<void> {
    // First enable editing mode
    this.editingComponents[componentId] = true;
    this.editingComponentValues[componentId] = this.getSearchTextOnly(componentId);
    this.computeDisplayValues(componentId); // Update computed editing state
    this.cdr.detectChanges();
    
    // Then show the suggestion toast and focus the textarea
    setTimeout(async () => {
      // Show the suggestion toast
      await this.onEditPhrase(componentId);
      
      // Focus the textarea and ensure proper sizing
      const textarea = document.querySelector(`textarea.phrase-input`) as HTMLTextAreaElement;
      if (textarea) {
        textarea.focus();
        this.autoResizeTextarea(textarea);
      }
    }, 0);
  }

  getEditingComponentValue(componentId: string): string {
    // Check if we have an editing value (including empty string)
    if (this.editingComponentValues.hasOwnProperty(componentId)) {
      return this.editingComponentValues[componentId];
    }
    // Fall back to original component key only if no editing value exists
    const component = this.findComponentById(componentId);
    return component?.key || '';
  }



  updateEditingComponent(componentId: string, event: any): void {
    this.editingComponentValues[componentId] = event.target.value;
    this.autoResizeTextarea(event.target);
  }

  onComponentKeyDown(componentId: string, event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      // Enter without shift sends the message
      event.preventDefault();
      this.sendUpdatedComponent(componentId);
    } else if (event.key === 'Enter' && event.shiftKey) {
      // Shift+Enter adds a new line (default behavior)
      // Let the default behavior happen, then resize
      setTimeout(() => {
        this.autoResizeTextarea(event.target as HTMLTextAreaElement);
      }, 0);
    }
  }

  autoResizeTextarea(textarea: HTMLTextAreaElement): void {
    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto';
    
    // Calculate new height (min 2 rows, max 3 rows)
    const lineHeight = 24; // Approximate line height
    const minHeight = lineHeight * 2; // 2 rows minimum (48px)
    const maxHeight = lineHeight * 3; // 3 rows maximum (72px)
    
    const newHeight = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight);
    textarea.style.height = newHeight + 'px';
  }

  hasChanges(componentId: string): boolean {
    // Check if we have an editing value (including empty string)
    if (!this.editingComponentValues.hasOwnProperty(componentId)) {
      return false;
    }
    const currentValue = this.editingComponentValues[componentId];
    const component = this.findComponentById(componentId);
    const originalValue = component?.key || '';
    return currentValue.trim() !== originalValue.trim();
  }

  sendUpdatedComponent(componentId: string): void {
    this.toggleExpansion(componentId);
    const newValue = this.editingComponentValues[componentId];
    
    if (!newValue || !newValue.trim()) {
      console.log('No new value entered, not sending');
      return;
    }

    console.log(`Requesting component edit for componentId: ${componentId} → "${newValue}"`);
    
    // Close the edit mode completely first
    this.finishEditingComponent(componentId);
    
    // Then send the request
    this.phraseEditRequested.emit({
      originalPhrase: 'UPDATE', // Non-empty value to indicate this is an update
      newPhrase: newValue.trim(),
      messageId: this.message.id || '',
      componentId: componentId
    });
  }


  finishEditingComponent(componentId: string): void {
    const newValue = this.editingComponentValues[componentId];
    const component = this.findComponentById(componentId);
    const originalValue = component?.key || '';
    
    if (newValue && newValue.trim() !== originalValue) {
      console.log(`Component changed from "${originalValue}" to "${newValue}"`);
    }
    
    this.editingComponents[componentId] = false;
    delete this.editingComponentValues[componentId];
    this.computeDisplayValues(componentId); // Update computed editing state
    this.cdr.detectChanges();
  }

  cancelEditingComponent(componentId: string): void {
    this.editingComponents[componentId] = false;
    delete this.editingComponentValues[componentId];
    this.computeDisplayValues(componentId); // Update computed editing state
    this.cdr.detectChanges();
  }

  // The backend returns the updated ChatMessage with the new foods structure

  // Add something functionality methods
  startAddingFood(): void {
    this.isAddingFood = true;
    this.newFoodPhrase = '';
    this.cdr.detectChanges();
    
    // Focus the textarea
    setTimeout(() => {
      const textarea = document.querySelector('.add-food-input') as HTMLTextAreaElement;
      if (textarea) {
        textarea.focus();
      }
    }, 100);
  }

  onAddFoodKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendNewFood();
    } else if (event.key === 'Escape') {
      this.cancelAddingFood();
    }
  }

  onAddFoodBlur(event: FocusEvent): void {
    // Delay canceling to allow send button click to work
    setTimeout(() => {
      if (!this.isSubmittingNewFood && this.isAddingFood) {
        this.cancelAddingFood();
      }
    }, 150);
  }

  // Build quick-lookup caches from the current message payload
  private rebuildLookupCaches(): void {
    this.componentById.clear();
    this.foodForComponentId.clear();
    this.selectedFoodByComponentId.clear();
    this.selectedServingIdByComponentId.clear();

    const foods = this.message?.logMealToolResponse?.foods || [];
    for (const food of foods) {
      const components = food.components || [];
      for (const component of components) {
        const cid = component?.id;
        if (!cid) continue;
        this.componentById.set(cid, component);
        this.foodForComponentId.set(cid, food);

        const matches: any[] = component?.matches || [];
        if (matches.length) {
          const selected: ComponentMatch = (matches.find(m => (m as any).isBestMatch) || matches[0]) as ComponentMatch;
          this.selectedFoodByComponentId.set(cid, selected);
          const originalSid = (selected as any)?.selectedServingId ?? selected.servings?.[0]?.providerServingId;
          if (originalSid) {
            // Set the original serving ID for backend operations
            (selected as any).selectedServingId = originalSid;
            this.selectedServingIdByComponentId.set(cid, originalSid);
            
            // Set the user virtual serving ID as default for display
            const userVirtualSid = originalSid + '::user';
            (selected as any).selectedVirtualServingId = userVirtualSid;
          }
        }
      }
    }
  }
  cancelAddingFood(): void {
    this.isAddingFood = false;
    this.newFoodPhrase = '';
    this.isSubmittingNewFood = false;
  }

  sendNewFood(): void {
    if (!this.newFoodPhrase?.trim() || this.isSubmittingNewFood) {
      return;
    }

    this.isSubmittingNewFood = true;
    this.cdr.detectChanges();

    // Use existing event with special handling for new foods
    this.phraseEditRequested.emit({
      originalPhrase: '', // Empty indicates this is a new addition
      newPhrase: this.newFoodPhrase.trim(),
      messageId: this.message.id || '',
      componentId: undefined // No specific component for new additions
    });

    // Reset the form
    this.cancelAddingFood();
  }

  private async showErrorToast(message: string): Promise<void> {
    await this.toastService.showToast({
      message: message,
      duration: 4000,
      color: 'danger'
    });
  }

  // Helper to detect if a ComponentMatch represents a common food (no brand name)
  isCommonFood(match: ComponentMatch): boolean {
    return !match.brandName || match.brandName.trim().length === 0;
  }

  // Helper to check if the selected food for a component is common
  isSelectedFoodCommon(componentId: string): boolean {
    const selectedFood = this.getSelectedFood(componentId);
    return selectedFood ? this.isCommonFood(selectedFood) : false;
  }

  // Get the original phrase for a component to use in the search
  getOriginalPhraseForComponent(componentId: string): string {
    const selectedFood = this.getSelectedFood(componentId);
    return selectedFood?.searchText || selectedFood?.originalText || selectedFood?.displayName || '';
  }

  // Toggle more options for a component
  async toggleMoreOptions(componentId: string): Promise<void> {
    if (this.showingMoreOptionsFor[componentId]) {
      this.showingMoreOptionsFor[componentId] = false;
      return;
    }

    if (this.moreOptionsFor[componentId] && this.moreOptionsFor[componentId].length > 0) {
      // Already have options, just show them
      this.showingMoreOptionsFor[componentId] = true;
      return;
    }

    // Need to fetch more options
    await this.fetchMoreOptions(componentId);
  }

  // Fetch more options from the backend
  async fetchMoreOptions(componentId: string): Promise<void> {
    try {
      this.loadingMoreOptionsFor[componentId] = true;
      const originalPhrase = this.getOriginalPhraseForComponent(componentId);
      
      if (!originalPhrase) {
        await this.showErrorToast('Could not determine original phrase for more options');
        return;
      }

      const request = new GetInstantAlternativesRequest({
        originalPhrase: originalPhrase,
        componentId: componentId,
        localDateKey: this.dateService.getSelectedDate()
      });

      const response = await this.apiService.getInstantAlternatives(request).toPromise();
      
      if (response?.isSuccess && response.alternatives) {
        this.moreOptionsFor[componentId] = response.alternatives;
        this.showingMoreOptionsFor[componentId] = true;
      } else {
        await this.showErrorToast('No additional options found');
      }
    } catch (error) {
      console.error('Error fetching more options:', error);
      await this.showErrorToast('Failed to fetch more options');
    } finally {
      this.loadingMoreOptionsFor[componentId] = false;
    }
  }

  // Select an option from the more options list
  onMoreOptionSelected(componentId: string, alternativeMatch: ComponentMatch): void {
    // Add the alternative to the component's matches if not already present
    const component = this.findComponentById(componentId);
    if (!component?.matches) return;

    const existingMatch = component.matches.find((m: any) => 
      m.providerFoodId === alternativeMatch.providerFoodId
    );

    if (!existingMatch) {
      // Add the new match to the component
      component.matches.push(alternativeMatch);
    }

    // Select this food
    const foodId = alternativeMatch.providerFoodId;
    if (foodId) {
      this.onFoodSelected(componentId, foodId);
    }

    // Hide more options
    this.showingMoreOptionsFor[componentId] = false;
  }

  // Track recent dropdown open calls to prevent multiple triggers
  private recentDropdownOpens: { [componentId: string]: number } = {};

  // Handle dropdown will open event - this is the ONLY place instant search should be triggered
  async onDropdownWillOpen(componentId: string): Promise<void> {
    console.log('onDropdownWillOpen called for componentId:', componentId);
  
    // Throttle multiple calls within 500ms
    const now = Date.now();
    const lastCall = this.recentDropdownOpens[componentId] || 0;
    if (now - lastCall < 500) {
      console.log('Throttling dropdown open call - too recent');
      return;
    }
    this.recentDropdownOpens[componentId] = now;
  
    if (!this.moreOptionsFor[componentId] && !this.loadingInstantOptionsFor[componentId]) {
      const loadingMatch = new ComponentMatch({
        providerFoodId: 'loading',
        displayName: 'Loading...',
        brandName: '',
        originalText: '',
        description: '',
        rank: 999,
        servings: [],
        selectedServingId: ''
      });
      this.moreOptionsFor[componentId] = [loadingMatch];
      this.loadingInstantOptionsFor[componentId] = true;
  
      // 🚫 don’t force detectChanges here
      await this.fetchInstantOptions(componentId);
    }
  }
  

  // Get display matches including loading state
  getDisplayMatches(componentId: string): ComponentMatch[] {
    const component = this.findComponentById(componentId);
    if (!component?.matches) return [];

    const baseMatches = component.matches || [];
    const instantOptions = this.moreOptionsFor[componentId] || [];
    const allMatches = [...baseMatches];
    
    // Add instant options (including loading placeholder)
    for (const option of instantOptions) {
      // If it's a loading placeholder, always add it
      if (option.providerFoodId === 'loading') {
        allMatches.push(option);
      } else {
        // For real options, only add if not already in base matches
        const exists = baseMatches.some((match: ComponentMatch) => match.providerFoodId === option.providerFoodId);
        if (!exists) {
          allMatches.push(option);
        }
      }
    }

    return allMatches;
  }

  // Fetch instant options when dropdown opens (similar to fetchMoreOptions but for dropdown)
  async fetchInstantOptions(componentId: string): Promise<void> {
    try {
      console.log('fetchInstantOptions starting for componentId:', componentId);
      this.loadingInstantOptionsFor[componentId] = true;
      const originalPhrase = this.getOriginalPhraseForComponent(componentId);
      
      console.log('Original phrase:', originalPhrase);
      if (!originalPhrase) {
        console.log('No original phrase found, returning');
        return;
      }

      const request = new GetInstantAlternativesRequest({
        originalPhrase: originalPhrase,
        componentId: componentId,
        localDateKey: this.dateService.getSelectedDate()
      });

      console.log('Making service call with request:', request);
      
      console.log('Calling foodSelectionService.getInstantAlternatives...');
      const response = await this.foodSelectionService.getInstantAlternatives(request).toPromise();
      console.log('Service response received successfully:', response);
      
      if (response?.isSuccess && response.alternatives) {
        console.log('Response is successful, replacing loading placeholder with alternatives. Count:', response.alternatives.length);
        this.moreOptionsFor[componentId] = response.alternatives;
        console.log('Real alternatives stored, replacing loading placeholder');
      } else {
        console.log('No successful response or alternatives, removing loading placeholder');
        this.moreOptionsFor[componentId] = []; // Remove loading placeholder
      }
    } catch (error) {
      console.error('Error fetching instant options:', error);
      // Remove loading placeholder on error
      this.moreOptionsFor[componentId] = [];
    } finally {
      console.log('fetchInstantOptions finally block - setting loading to false');
      this.loadingInstantOptionsFor[componentId] = false;
      this.cdr.detectChanges();
      console.log('detectChanges completed - loading state updated');
    }
  }

  // Event handlers for child component integration
  handleQuantityChange(event: {componentId: string, quantity: number}): void {
    // Create a mock serving for the quantity change since onInlineQtyChanged expects a ComponentServing
    // We need to get the current serving and pass it along
    const currentServing = this.getSelectedServing(event.componentId);
    if (currentServing) {
      this.onInlineQtyChanged(event.componentId, currentServing, event.quantity);
    }
  }

  handleFoodSelected(event: {componentId: string, food: ComponentMatch}): void {
    const foodId = event.food.providerFoodId;
    if (foodId) {
      this.onFoodSelected(event.componentId, foodId);
    }
  }
}

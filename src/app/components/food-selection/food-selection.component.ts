import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, ChangeDetectorRef, ViewChild, NO_ERRORS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { addIcons } from 'ionicons';
import { createOutline, chevronUpOutline, chevronDownOutline, trashOutline, send, addCircleOutline, ellipsisHorizontal } from 'ionicons/icons';
import { ComponentMatch, ComponentServing, SubmitServingSelectionRequest, UserSelectedServing, SubmitEditServingSelectionRequest, MessageRoleTypes, NutritionAmbitionApiService, SearchFoodPhraseRequest, UserEditOperation, EditFoodSelectionType, LogMealToolResponse, GetInstantAlternativesRequest, GetInstantAlternativesResponse } from 'src/app/services/nutrition-ambition-api.service';
import { FoodComponentItemComponent } from './food-component-item/food-component-item.component';
import { SearchFoodComponent } from './search-food/search-food.component';
import { FoodHeaderComponent } from './food-header/food-header.component';
import { FoodSelectionActionsComponent } from './food-selection-actions/food-selection-actions.component';
import { DisplayMessage } from 'src/app/models/display-message';
import { ComponentDisplay, FoodDisplay, ComponentDataDisplay } from 'src/app/models/food-selection-display';
import { ToastService } from 'src/app/services/toast.service';
import { DateService } from 'src/app/services/date.service';
import { FoodSelectionService } from 'src/app/services/food-selection.service';
import { IonIcon } from '@ionic/angular/standalone';

@Component({
  selector: 'app-food-selection',
  templateUrl: './food-selection.component.html',
  styleUrls: ['./food-selection.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, FoodComponentItemComponent, SearchFoodComponent, FoodHeaderComponent, FoodSelectionActionsComponent, IonIcon],
  schemas: [NO_ERRORS_SCHEMA]
})
export class FoodSelectionComponent implements OnInit, OnChanges {
  @Input() message!: DisplayMessage;
  @Input() isEditingPhrase: boolean = false;
  @Output() selectionConfirmed = new EventEmitter<SubmitServingSelectionRequest>();
  @Output() editConfirmed = new EventEmitter<SubmitEditServingSelectionRequest>();
  @Output() cancel = new EventEmitter<void>();
  @Output() updatedMessage = new EventEmitter<DisplayMessage>();
  @Output() phraseEditRequested = new EventEmitter<{originalPhrase: string, newPhrase: string, messageId: string, componentId?: string}>();

  @ViewChild(SearchFoodComponent) addFoodComponent?: SearchFoodComponent;

  isReadOnly = false;
  isEditMode = false;
  isAddingFood = false;

  expandedSections: { [componentId: string]: boolean } = {};
  expandedFoods: { [foodIndex: number]: boolean } = {}; // Track food-level expansion
  removedComponents: Set<string> = new Set();
  isSubmitting = false;
  isCanceling = false;
  private cancelTimeout: any = null;
  editingComponents: { [componentId: string]: boolean } = {};
  editingComponentValues: { [componentId: string]: string } = {};
  searchingComponents: { [componentId: string]: boolean } = {};
  

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
  
  // Consolidated display data for components - eliminates all function calls from template
  public componentDisplayData: { [componentId: string]: {
    displayName: string;
    isInferred: boolean;
    isExpanded: boolean;
    isSearching: boolean;
    isEditing: boolean;
    editingValue: string;
    hasChanges: boolean;
    servingSelections: { [servingId: string]: boolean };
  }} = {};

  // Legacy maps kept for backward compatibility during transition
  private computedDisplayNames = new Map<string, string>(); // componentId -> display name
  private computedIsInferred = new Map<string, boolean>(); // componentId -> is inferred
  private computedIsExpanded = new Map<string, boolean>(); // componentId -> is expanded
  public computedIsSearching = new Map<string, boolean>(); // componentId -> is searching
  public computedIsComponentEditing = new Map<string, boolean>(); // componentId -> is editing
  public computedEditingValues = new Map<string, string>(); // componentId -> editing value
  private computedHasChanges = new Map<string, boolean>(); // componentId -> has changes
  
  // Food level precomputed values
  private computedFoodNames = new Map<number, string>(); // foodIndex -> food name

  // Precomputed foods array with all display state embedded - eliminates all method calls in template
  computedFoods: FoodDisplay[] = [];

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
    this.isAddingFood = false; // Ensure this is always false on init
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

      // Reset add food component when message updates (after successful food addition)
      if (this.addFoodComponent) {
        this.addFoodComponent.resetSubmissionState();
      }

      // Reset adding food state when message changes
      this.isAddingFood = false;

      this.rebuildLookupCaches();
      this.initializeComputedValues();
    }
    if (changes['isReadOnly'] && this.isReadOnly) this.isSubmitting = false;
  }



  toggleExpansion(componentId: string): void {
    // Get current state from component or fallback to map
    const component = this.findComponentById(componentId);
    const currentState = component?.isExpanded ?? !!this.expandedSections[componentId];
    const newState = !currentState;

    // Update the component flag directly (primary source of truth)
    this.updateComponentFlag(componentId, component => {
      component.isExpanded = newState;
    });

    // Keep legacy map in sync for backward compatibility during transition
    this.expandedSections[componentId] = newState;
    this.computedIsExpanded.set(componentId, newState);
  }

  isExpanded(componentId: string): boolean {
    const component = this.findComponentById(componentId);
    return component?.isExpanded ?? !!this.expandedSections[componentId];
  }

  // Food-level expansion methods
  toggleFoodExpansion(foodIndex: number): void {
    this.expandedFoods[foodIndex] = !this.expandedFoods[foodIndex];
  }

  isFoodExpanded(foodIndex: number): boolean {
    return !!this.expandedFoods[foodIndex];
  }

  // Get components for a specific food
  getComponentsForFood(food: any): ComponentDataDisplay[] {
    if (!food?.components) return [];

    // Return empty if the food has been removed
    if (food.id && this.removedFoods.has(food.id)) {
      return [];
    }

    const activeComponents = food.components.filter((component: any) => component.id && !(component as any).isRemoved);
    const isSingleComponentFood = activeComponents.length === 1;
    const parentQuantity = food.quantity || 1;

    // Filter out removed components and create ComponentDisplay objects with editing state
    return activeComponents.map((component: any) => {
        const componentDisplay = new ComponentDisplay({
          ...component,
          // Get display state from the component if available, otherwise fallback to maps
          isEditing: component.isEditing ?? this.isComponentBeingEdited(component.id),
          editingValue: component.editingValue ?? this.getEditingComponentValue(component.id),
          isExpanded: component.isExpanded ?? !!this.expandedSections[component.id],
          isSearching: (component as any).isSearching ?? this.isSearchingComponent(component.id),
          showingMoreOptions: component.showingMoreOptions ?? !!this.showingMoreOptionsFor[component.id],
          loadingMoreOptions: component.loadingMoreOptions ?? !!this.loadingMoreOptionsFor[component.id],
          loadingInstantOptions: component.loadingInstantOptions ?? !!this.loadingInstantOptionsFor[component.id],
          moreOptions: component.moreOptions ?? (this.moreOptionsFor[component.id] || [])
        });
        return {
          componentId: component.id,
          component: componentDisplay,
          isSingleComponentFood: isSingleComponentFood,
          parentQuantity: parentQuantity
        } as ComponentDataDisplay;
      });
  }

  // All remaining components across foods (excludes removed foods/components)
  get availableComponents(): ComponentDataDisplay[] {
    if (!this.message?.logMealToolResponse?.foods) return [];
    const result: ComponentDataDisplay[] = [];
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
  getFoodTotalCaloriesFromComponents(food: any, foodComponents: ComponentDataDisplay[]): number {
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
    const food = this.message.logMealToolResponse?.foods?.[foodIndex];
    if (!food) return;

    const currentState = (food as any).isEditingExpanded ?? !!this.expandedFoodEditing[foodIndex];
    const newState = !currentState;

    // Update the food flag directly (primary source of truth)
    (food as any).isEditingExpanded = newState;
    if (newState) {
      (food as any).editingQuantity = food.quantity || 1;
    } else {
      delete (food as any).editingQuantity;
    }

    // Keep legacy map in sync for backward compatibility during transition
    this.expandedFoodEditing[foodIndex] = newState;
    if (newState) {
      this.editingFoodQuantities[foodIndex] = food.quantity || 1;
    } else {
      delete this.editingFoodQuantities[foodIndex];
    }

    // Recompute all foods to reflect the change
    this.computeAllFoods();
  }

  isFoodEditingExpanded(foodIndex: number): boolean {
    const food = this.message.logMealToolResponse?.foods?.[foodIndex];
    if (!food) return false;

    // Auto-expand if any component in this food is being edited
    if (food.components) {
      for (const component of food.components) {
        if (component.matches && component.matches.length > 0 && (component.matches[0] as any).isEditingPhrase) {
          return true;
        }
      }
    }

    // Check food display property first, otherwise fallback to legacy map
    return (food as any).isEditingExpanded ?? !!this.expandedFoodEditing[foodIndex];
  }

  getFoodServingLabel(food: any): string {
    // For multi-component foods, get the serving label from the first component's selected serving
    if (food.components && food.components.length > 0) {
      const firstComponent = food.components[0];
      const selectedServing = this.getSelectedServing(firstComponent.id);
      if (selectedServing) {
        const quantity = this.getDisplayedQuantity(selectedServing) || 1;
        const unit = this.getUnitText(selectedServing);
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
    const food = this.message.logMealToolResponse?.foods?.[foodIndex];
    if (!food) return;

    // Get quantity from food display property or legacy map
    const newQuantity = (food as any).editingQuantity ?? this.editingFoodQuantities[foodIndex];
    if (newQuantity && newQuantity > 0) {
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

  onFoodQuantityChange(foodIndex: number, newQuantity: number): void {
    const food = this.message.logMealToolResponse?.foods?.[foodIndex];
    if (food) {
      // Update the food display property directly (primary source of truth)
      (food as any).editingQuantity = newQuantity;
    }

    // Keep legacy map in sync for backward compatibility
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
    if (cached) {
      // console.log('🍎 getSelectedFood for', componentId, '- using cached');
      return cached;
    }

    const component = this.findComponentById(componentId);
    const matches: any[] = component?.matches || [];
    console.log('🍎 getSelectedFood for', componentId, '- component found:', !!component, 'matches:', matches.length);
    if (!matches.length) return null;

    const selected = (matches.find(m => (m as any).isBestMatch) || matches[0]) as ComponentMatch;
    this.selectedFoodByComponentId.set(componentId, selected);

    // Auto-select the first serving if none is selected yet
    if (selected.servings?.[0]?.id) {
      const firstServingId = selected.servings[0].id;
      const currentSelection = this.foodSelectionService.getSelectedServing(componentId);
      console.log('🍎 Auto-selecting serving - currentSelection:', currentSelection, 'firstServingId:', firstServingId);
      if (!currentSelection) {
        this.foodSelectionService.selectServing(componentId, firstServingId);
      }
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

  // Helper method to update flags on ComponentDisplay objects by finding them in the data
  private updateComponentFlag(componentId: string, flagUpdate: (component: any) => void): void {
    if (!this.message?.logMealToolResponse?.foods) return;

    // Update the flag in the original component data
    for (const food of this.message.logMealToolResponse.foods) {
      if (food.components) {
        for (const component of food.components) {
          if (component.id === componentId) {
            flagUpdate(component);
            // Recompute all foods to reflect the changes
            this.computeAllFoods();
            return;
          }
        }
      }
    }
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
        (match as any).selectedServingId = match.servings?.[0]?.id;
        // Set the user virtual serving ID as default for display (preselects user's preferred units)
        const originalSid = match.servings?.[0]?.id;
        if (originalSid) {
          const newVirtualSid = originalSid + '::user';
          (match as any).selectedVirtualServingId = newVirtualSid;
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
      const sid = (selectedMatch as any)?.selectedServingId ?? selectedMatch.servings?.[0]?.id;
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

      // Update the FoodSelectionService with the new selection (using the new GUID id)
      this.foodSelectionService.selectServing(componentId, servingId);

      // Immediately update the precomputed selection state to ensure UI updates
      this.computeDisplayValues(componentId);

      // Force change detection to update UI when serving selection changes
      this.cdr.detectChanges();

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

  onServingQuantityChanged(componentId: string, servingId: string, quantity: number): void {
    console.log('🔧 Quantity changed:', { componentId, servingId, quantity });

    // CRITICAL: Update the quantity in the food-selection service first
    this.foodSelectionService.updateServingQuantity(componentId, servingId, quantity);
    console.log('🔧 Updated service quantity');

    // Trigger change detection and recompute to update food-level macros
    this.cdr.detectChanges();
    this.computeAllFoods();
    console.log('🔧 Recomputed all foods - food-level macros should update');
  }

  getSelectedServingId(componentId: string): string | undefined {
    // Use the food-selection service to get the currently selected serving
    const selectedServingFromService = this.foodSelectionService.getSelectedServing(componentId);
    if (selectedServingFromService) {
      return selectedServingFromService;
    }

    // Fallback: get the first serving from the selected food
    const selectedFood = this.getSelectedFood(componentId);
    const firstServingId = selectedFood?.servings?.[0]?.id;

    if (firstServingId) {
      // Auto-select this serving in the service
      this.foodSelectionService.selectServing(componentId, firstServingId);
      return firstServingId;
    }

    return undefined;
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
    const firstServingId = (sf: any) => sf?.servings?.[0]?.id;
    return firstServingId(selectedFood);
  }

  getSelectedServing(componentId: string): ComponentServing | null {
    const food = this.getSelectedFood(componentId);
    const selectedServingId = this.getSelectedServingId(componentId);
    console.log('🎂 getSelectedServing for', componentId, '- food:', !!food, 'selectedServingId:', selectedServingId);

    if (selectedServingId && food?.servings) {
      // Find the serving with the matching GUID ID
      const selected = food.servings.find((s: any) => s.id === selectedServingId) || null;
      console.log('🎂 Found selected serving:', !!selected, selected?.id);
      return selected;
    }

    // Fallback: return the first serving if available
    if (food?.servings?.[0]) {
      console.log('🎂 Using fallback first serving:', food.servings[0].id);
      return food.servings[0];
    }

    console.log('🎂 No serving found - returning null');
    return null;
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
            if (!component.id || (component as any).isRemoved) continue;

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
            if (!component.id || (component as any).isRemoved) continue;

            const selectedFood = this.getSelectedFood(component.id);
            const servingId = this.getOriginalServingId(component.id);
            const selectedServing = this.getSelectedServing(component.id);

            if ((selectedFood as any)?.providerFoodId && servingId && selectedServing) {
              const displayQuantity = this.getEffectiveQuantity(component.id, selectedServing);
              // Use the frontend's calculated scaling - it's already correct!
              const scaledQuantity = this.getDisplayedQuantity(selectedServing);

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

    // Use new formula: displayedQuantity = baseQuantity × aiRecommendedScale
    const dq = this.getDisplayedQuantity(s);
    const du = this.getDisplayUnit(s);
    if (dq !== undefined && du && du.trim()) {
      return `${this.formatQuantity(dq)} ${du}`.trim();
    }

    // Fall back to description if available
    if (s.description && s.description.trim()) {
      return s.description;
    }

    return 'serving';
  }

  getDisplayQuantity(s: ComponentServing | null): number {
    if (!s) return 1;

    // Use new formula: displayedQuantity = baseQuantity × aiRecommendedScale
    const baseQuantity = s.baseQuantity || 1;
    const aiScale = s.aiRecommendedScale || 1;
    const displayedQuantity = baseQuantity * aiScale;

    if (isFinite(displayedQuantity) && displayedQuantity > 0) return displayedQuantity;

    return 1;
  }

  getEffectiveQuantity(componentId: string, serving: ComponentServing | null): number {
    // Always prioritize the serving's displayed quantity for UI display
    // This ensures the stepper shows the correct UI value (e.g., 0.42 cup instead of 100)
    if (serving) {
      const displayedQuantity = this.getDisplayedQuantity(serving);
      if (displayedQuantity !== undefined && isFinite(displayedQuantity) && displayedQuantity > 0) {
        return displayedQuantity;
      }
    }

    // Fall back to food's effectiveQuantity only if serving's displayed quantity is not available
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

    const userDisplayedQuantity = this.getDisplayedQuantity(serving);
    const userDisplayUnit = this.getDisplayUnit(serving);

    // Create user-anchored serving (user's exact input) - this should be pre-selected
    const userServing = new ComponentServing({
      ...serving,
      providerServingId: serving.providerServingId + '::user',
      baseQuantity: userDisplayedQuantity, // User's exact quantity (e.g., 100)
      baseUnit: userDisplayUnit,           // User's exact unit (e.g., "g")
      aiRecommendedScale: 1,               // Scale of 1 for user input
      description: `${userDisplayedQuantity} ${userDisplayUnit}`,
      // Keep the same nutrients
      nutrients: serving.nutrients
    });

    // For now, we'll only return the user serving as the backend is being updated
    // to handle the new dual serving structure
    return [userServing];
  }

  getUnitText(s: ComponentServing): string {
    // Use the new display unit logic
    const unit = this.getDisplayUnit(s);
    if (unit && unit.trim().length) return unit.trim();

    // Fall back to description parsing if display unit is empty
    const desc = s.description;
    if (desc && desc.trim().length) {
      const stripped = this.stripLeadingCount(desc);
      if (stripped && stripped.trim()) return stripped.trim();
    }

    return 'serving';
  }

  /**
   * Get the displayed quantity using the new formula: baseQuantity × aiRecommendedScale
   */
  private getDisplayedQuantity(s: ComponentServing | null): number {
    if (!s) return 1;

    const baseQuantity = s.baseQuantity || 1;
    const aiScale = s.aiRecommendedScale || 1;
    return baseQuantity * aiScale;
  }

  /**
   * Get the display unit using proper grammar (singular vs plural)
   */
  private getDisplayUnit(s: ComponentServing | null): string {
    if (!s) return 'serving';

    const quantity = this.getDisplayedQuantity(s);

    // Use singularUnit when quantity is 1, pluralUnit otherwise
    if (quantity === 1) {
      return s.singularUnit || s.baseUnit || 'serving';
    } else {
      return s.pluralUnit || s.baseUnit || 'servings';
    }
  }

  // Debug method to check if serving is selected
  isServingSelected(componentId: string, serving: ComponentServing): boolean {
    const selectedId = this.getSelectedServingId(componentId);
    const servingId = serving.id;
    const isSelected = selectedId === servingId;
    return isSelected;
  }

  // Method to get selected servings for all components in a food with quantity-scaled nutrients
  getSelectedServingsForFood(food: any): { [componentId: string]: any } {
    const selectedServings: { [componentId: string]: any } = {};
    // console.log('🍽️ Getting selected servings for food:', food?.id || food?.name);

    // Use computedComponents if available (FoodDisplay), otherwise fallback to components (raw food)
    const componentsToCheck = (food as any).computedComponents || food?.components;

    if (componentsToCheck) {
      for (const componentData of componentsToCheck) {
        // Extract component from componentData if it's a ComponentDataDisplay
        const component = componentData.component || componentData;

        // Skip removed components - this is the key fix!
        // console.log('🍽️ Component', component.id, 'isRemoved:', !!(component as any).isRemoved);
        if (component.id && !(component as any).isRemoved) {
          const selectedServing = this.getSelectedServing(component.id);
          if (selectedServing) {
            // Get the current quantity multiplier from the food-selection service
            const servingId = selectedServing.id || '';
            const currentQuantity = this.foodSelectionService.getServingQuantity(component.id, servingId);
            // console.log('🍽️ Component', component.id, 'quantity:', currentQuantity);

            // Create a copy of the serving with scaled nutrients
            const servingWithScaledNutrients = {
              ...selectedServing,
              nutrients: this.scaleNutrientsByQuantity(selectedServing.nutrients, currentQuantity)
            };
            selectedServings[component.id] = servingWithScaledNutrients;
          }
        }
      }
    }

    return selectedServings;
  }

  // Simple helper to scale nutrients by a quantity multiplier
  private scaleNutrientsByQuantity(nutrients: { [key: string]: number } | undefined, quantity: number): { [key: string]: number } | undefined {
    if (!nutrients || quantity === 1) {
      return nutrients;
    }

    const scaledNutrients: { [key: string]: number } = {};
    for (const [key, value] of Object.entries(nutrients)) {
      if (typeof value === 'number') {
        scaledNutrients[key] = value * quantity;
      }
    }
    return scaledNutrients;
  }

  // Scale nutrients for a serving (similar to food-component-item logic)
  private getScaledNutrientsForServing(componentId: string, serving: ComponentServing): { [key: string]: number } | null {
    const currentQuantity = this.getEffectiveQuantity(componentId, serving);

    // If serving has nutrient data, scale it by current quantity
    if (serving.nutrients && Object.keys(serving.nutrients).length > 3) { // More than just basic fields
      const scaledNutrients: { [key: string]: number } = {};
      for (const [key, value] of Object.entries(serving.nutrients)) {
        if (typeof value === 'number') {
          scaledNutrients[key] = value * currentQuantity;
        }
      }
      return scaledNutrients;
    }

    // Alternative serving has no nutrients - scale from base serving
    const food = this.getSelectedFood(componentId);
    if (!food?.servings) return null;

    // Find base serving (should be the first one with nutrients)
    const baseServing = food.servings.find((s: any) => s.nutrients && Object.keys(s.nutrients).length > 3);
    if (!baseServing?.nutrients) {
      return null;
    }

    // Calculate scale factor: altWeight / baseWeight
    const baseWeight = baseServing.metricServingAmount;
    const altWeight = serving.metricServingAmount;

    if (!baseWeight || !altWeight || baseWeight <= 0) return null;

    const weightScaleFactor = altWeight / baseWeight;
    const totalScaleFactor = weightScaleFactor * currentQuantity;

    // Scale all nutrients from the base serving
    const scaledNutrients: { [key: string]: number } = {};
    for (const [key, value] of Object.entries(baseServing.nutrients)) {
      if (typeof value === 'number') {
        scaledNutrients[key] = value * totalScaleFactor;
      }
    }

    return scaledNutrients;
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
      const servingId = serving.id;
      if (servingId) {
        servingLabels.set(servingId, this.getServingLabel(serving));
        unitTexts.set(servingId, this.getUnitText(serving));
        effectiveQuantities.set(servingId, this.getEffectiveQuantity(componentId, serving));
      }
    }
    
    this.computedServingLabelsByServing.set(componentId, servingLabels);
    this.computedUnitTexts.set(componentId, unitTexts);
    this.computedEffectiveQuantities.set(componentId, effectiveQuantities);

    // Compute component state values FIRST (before serving checks) so loading components work
    this.computedDisplayNames.set(componentId, this.getDisplayNameOrSearchText(componentId));
    this.computedIsInferred.set(componentId, this.isInferred(componentId));
    this.computedIsExpanded.set(componentId, this.isExpanded(componentId));
    this.computedIsSearching.set(componentId, this.isSearchingComponent(componentId));
    this.computedIsComponentEditing.set(componentId, this.isComponentBeingEdited(componentId));
    this.computedEditingValues.set(componentId, this.getEditingComponentValue(componentId));
    this.computedHasChanges.set(componentId, this.hasChanges(componentId));

    // Populate consolidated display data object
    const servingSelectionsObj: { [servingId: string]: boolean } = {};
    for (const serving of dualOptions) {
      const servingId = serving.providerServingId;
      if (servingId) {
        servingSelectionsObj[servingId] = this.isServingSelected(componentId, serving);
      }
    }

    this.componentDisplayData[componentId] = {
      displayName: this.getDisplayNameOrSearchText(componentId),
      isInferred: this.isInferred(componentId),
      isExpanded: this.isExpanded(componentId),
      isSearching: this.isSearchingComponent(componentId),
      isEditing: this.isComponentBeingEdited(componentId),
      editingValue: this.getEditingComponentValue(componentId),
      hasChanges: this.hasChanges(componentId),
      servingSelections: servingSelectionsObj
    };

    if (!selectedServing) {
      this.computedServingLabels.set(componentId, '');
      this.computedCalories.set(componentId, null);
      this.computedDisplayQuantities.set(componentId, 0);
      this.computedDisplayUnits.set(componentId, '');
      return;
    }

    // Compute serving label - create a simple label directly from the serving
    const rawQuantity = this.getDisplayedQuantity(selectedServing) || 1;
    // Format quantity to remove floating point precision issues and limit decimal places
    const quantity = this.formatQuantity(rawQuantity);
    const unit = this.getUnitText(selectedServing);
    const servingLabel = `${quantity} ${unit}`;
    this.computedServingLabels.set(componentId, servingLabel);

    // Compute calories
    const calories = this.caloriesForServing(selectedServing);
    this.computedCalories.set(componentId, calories);

    // Compute display quantity and unit
    this.computedDisplayQuantities.set(componentId, this.getDisplayedQuantity(selectedServing) || 0);
    this.computedDisplayUnits.set(componentId, this.getDisplayUnit(selectedServing) || '');
    
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

  // Check if any component is in editing phrase mode (for main loading overlay)
  getIsEditingPhrase(): boolean {
    if (!this.message.logMealToolResponse?.foods) return false;

    for (const food of this.message.logMealToolResponse.foods) {
      if (food.components) {
        for (const component of food.components) {
          if (component.matches && component.matches.length > 0 && (component.matches[0] as any).isEditingPhrase) {
            return true;
          }
        }
      }
    }
    return false;
  }

  getComputedEditingValue(componentId: string): string {
    return this.computedEditingValues.get(componentId) || '';
  }

  getComputedHasChanges(componentId: string): boolean {
    return this.computedHasChanges.get(componentId) || false;
  }


  // Food level getters
  getComputedFoodName(foodIndex: number): string {
    return this.computedFoodNames.get(foodIndex) || '';
  }



  // Helper to recompute both display values and food components for a component
  private recomputeComponentAndFood(componentId: string): void {
    this.computeDisplayValues(componentId);
    // Recompute all foods since component changed
    this.computeAllFoods();
  }

  // Compute all foods as FoodDisplay objects with embedded state
  private computeAllFoods(): void {
    const rawFoods = this.message?.logMealToolResponse?.foods || [];

    this.computedFoods = rawFoods.map((food, foodIndex) => {
      const foodDisplay = new FoodDisplay({
        ...food,
        isEditingExpanded: this.isFoodEditingExpanded(foodIndex),
        computedComponents: this.getComponentsForFood(food)
      });

      // Precompute currentQuantity to avoid template expression
      (foodDisplay as any).precomputedCurrentQuantity = (foodDisplay as any).editingQuantity ?? this.editingFoodQuantities[foodIndex] ?? food.quantity ?? 1;

      // Precompute selectedServings to avoid calling method in template
      // Use foodDisplay which has the component display data with isRemoved flags
      (foodDisplay as any).precomputedSelectedServings = this.getSelectedServingsForFood(foodDisplay);

      return foodDisplay;
    });
  }


  // Initialize computed values for all components
  private initializeComputedValues(): void {
    const foods = this.message?.logMealToolResponse?.foods || [];

    for (let foodIndex = 0; foodIndex < foods.length; foodIndex++) {
      const food = foods[foodIndex];

      // Compute food-level values
      this.computedFoodNames.set(foodIndex, this.getFoodNameWithIngredientCount(food));

      for (const component of food.components || []) {
        const componentId = component.id;
        if (componentId) {
          this.computeDisplayValues(componentId);
        }
      }
    }

    // Compute all foods with embedded display state
    this.computeAllFoods();
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
  

  // Scale a macro per 1 serving by the displayed quantity
  private scaledMacro(s: ComponentServing | null, keys: string[]): number | null {
    if (!s || !s.nutrients) return null;
    const base = this.getMacro(s.nutrients, keys);
    if (base == null) return null;
    const q = this.getDisplayedQuantity(s);
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

      // Set the isRemoved flag directly on the component
      this.updateComponentFlag(componentId, component => {
        component.isRemoved = true;
      });

      // Follow the same pattern as quantity changes - rebuild all computed foods
      // This creates new FoodDisplay objects that Angular will detect as changes
      this.computeAllFoods();

      // Clean up food-selection service state for this component
      const selectedServing = this.getSelectedServing(componentId);
      console.log('🗑️ Removing component:', componentId, 'selectedServing:', selectedServing?.id);
      if (selectedServing?.id) {
        // Clear the serving selection and quantity tracking for this component
        this.foodSelectionService.updateServingQuantity(componentId, selectedServing.id, 0);
        console.log('🗑️ Cleared quantity tracking for removed component');
      }

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
              // Restore the component by clearing the isRemoved flag
              this.updateComponentFlag(componentId, component => {
                component.isRemoved = false;
              });

              // Force recomputation of precomputed values so food-header updates
              this.computeAllFoods();

              // In edit mode, also remove the operation
              if (this.isEditMode) {
                this.editOperations = this.editOperations.filter(op =>
                  !(op.action === EditFoodSelectionType.RemoveComponent && op.componentId === componentId)
                );
              }

              console.log('🔄 Undoing removal for component:', componentId);
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
    // 0) guard
    const component = this.findComponentById(componentId);
    if (!component) {
      return;
    }

    // 1) compute targetMass in metric (g/ml)
    const selMetricAmt = this.getMetricAmt(selected); // per "one" serving of selected
    const selIsMetric = this.isMetricRow(selected);
    let targetMass = NaN;

    if (selIsMetric) {
      // if selected row's unit is already metric, editedQty is the targetMass (e.g., 120 g)
      targetMass = editedQty;
    } else {
      // household/size row: convert to metric via its per-serving metric amount
      // editedQty (e.g., 2 large) * 50 g (metric per 1 large) → 100 g target
      targetMass = editedQty * (isFinite(selMetricAmt) ? selMetricAmt : NaN);
    }

    if (!isFinite(targetMass) || targetMass <= 0) {
      return;
    }

    // 2) iterate all servings in the selected food and update the new properties
    const selectedFood = this.getSelectedFood(componentId);
    if (!selectedFood?.servings) {
      return;
    }

    // ensure exactly one best match (the edited row)
    const editedId = selected.providerServingId;

    for (const s of selectedFood.servings) {
      const mAmt = this.getMetricAmt(s);
      const hasMetric = isFinite(mAmt) && mAmt > 0;

      // Calculate the new scale factor based on target mass
      let newScale = 1;
      const baseQuantity = s.baseQuantity || 1;

      if (hasMetric) {
        // math: aiRecommendedScale = targetMass / (baseQuantity * metricServingAmount)
        const totalMetricForBase = baseQuantity * mAmt;
        if (totalMetricForBase > 0) {
          newScale = targetMass / totalMetricForBase;
        }
      } else {
        // For non-metric, calculate scale based on the edited quantity
        if (s.providerServingId === editedId) {
          newScale = editedQty / baseQuantity;
        }
      }

      if (!isFinite(newScale) || newScale < 0) newScale = 1;

      // Update the new properties
      (s as any).aiRecommendedScale = newScale;

      // Update unit text based on the new quantity
      const newDisplayedQuantity = baseQuantity * newScale;
      if (newDisplayedQuantity === 1) {
        // Keep singularUnit or set appropriate unit
        if (!s.singularUnit) {
          const mu = this.getMetricUnit(s);
          const desc = (s as any).description as string | undefined;
          const md = (s as any).measurementDescription as string | undefined;

          if (this.isMetricRow(s) && mu) {
            (s as any).singularUnit = mu;
            (s as any).pluralUnit = mu;
          } else {
            const label = (desc && desc.trim().length > 0 ? desc : (md || '')).trim();
            const strippedLabel = this.stripLeadingCount(label) || 'serving';
            (s as any).singularUnit = strippedLabel;
            (s as any).pluralUnit = strippedLabel + 's';
          }
        }
      }

      // mark best match
      (s as any).isBestMatch = (s as any).providerServingId === editedId;
    }

    // ensure UI shows the edited row as selected
    if (editedId) {
      this.onServingSelected(componentId, editedId);
    }
  }



  async cancelSelection(): Promise<void> {
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
      this.cancel.emit();
      this.cancelTimeout = null;
      // Note: isCanceling will be reset by parent when API response comes back
    }, 5000);
    
    // Listen for toast dismissal (if user dismisses manually)
    toast.onDidDismiss().then((result) => {
      // If toast was dismissed but not by undo button, proceed with cancellation
      if (result.role !== 'cancel' && this.isCanceling && this.cancelTimeout) {
        // User dismissed toast manually - proceed with cancellation immediately
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
      return;
    }
    
    // Look for textarea first (edit mode), then phrase text (display mode)
    let targetElement = componentContainer.querySelector('textarea.phrase-input') as HTMLElement;
    if (!targetElement) {
      targetElement = componentContainer.querySelector('.phrase-text') as HTMLElement;
    }
    
    if (!targetElement) {
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
    const component = this.findComponentById(componentId);
    return component?.isEditing ?? !!this.editingComponents[componentId];
  }

  isSearchingComponent(componentId: string): boolean {
    const component = this.findComponentById(componentId);

    // Check component display property first
    if (component?.isSearching !== undefined) {
      return component.isSearching;
    }

    // Check if this component has a ComponentMatch with isEditingPhrase = true
    const isSearching = component?.matches && component.matches.length > 0 && (component.matches[0] as any).isEditingPhrase;
    if (isSearching) {
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
    // Update the component flag directly (primary source of truth)
    this.updateComponentFlag(componentId, component => {
      component.isEditing = true;
      component.editingValue = this.getSearchTextOnly(componentId);
    });

    // Keep legacy maps in sync for backward compatibility during transition
    this.editingComponents[componentId] = true;
    this.editingComponentValues[componentId] = this.getSearchTextOnly(componentId);
    this.computeDisplayValues(componentId);

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
    const component = this.findComponentById(componentId);

    // Get editing value from component if available, otherwise fallback to map
    if (component?.editingValue !== undefined) {
      return component.editingValue;
    }

    // Check legacy map for backward compatibility
    if (this.editingComponentValues.hasOwnProperty(componentId)) {
      return this.editingComponentValues[componentId];
    }

    // Fall back to original component key only if no editing value exists
    return component?.key || '';
  }



  updateEditingComponent(componentId: string, event: any): void {
    const newValue = event.target.value;

    // Update the component flag directly (primary source of truth)
    this.updateComponentFlag(componentId, component => {
      component.editingValue = newValue;
    });

    // Keep legacy map in sync for backward compatibility
    this.editingComponentValues[componentId] = newValue;
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
    const component = this.findComponentById(componentId);

    // Get editing value from component or legacy map
    let currentValue = '';
    if (component?.editingValue !== undefined) {
      currentValue = component.editingValue;
    } else if (this.editingComponentValues.hasOwnProperty(componentId)) {
      currentValue = this.editingComponentValues[componentId];
    } else {
      return false;
    }

    const originalValue = component?.key || '';
    return currentValue.trim() !== originalValue.trim();
  }

  sendUpdatedComponent(eventOrComponentId: {componentId: string; newPhrase: string} | string): void {
    let componentId: string;
    let newPhrase: string;

    // Handle both old (string) and new (object) call patterns
    if (typeof eventOrComponentId === 'string') {
      // Old pattern: just componentId, get newPhrase from editing values
      componentId = eventOrComponentId;
      newPhrase = this.editingComponentValues[componentId] || '';
    } else {
      // New pattern: event object with both values
      componentId = eventOrComponentId.componentId;
      newPhrase = eventOrComponentId.newPhrase;
    }

    this.toggleExpansion(componentId);

    if (!newPhrase || !newPhrase.trim()) {
      return;
    }

    // Close the edit mode completely first
    this.finishEditingComponent(componentId);

    // Then send the request using the newPhrase value
    this.phraseEditRequested.emit({
      originalPhrase: 'UPDATE', // Non-empty value to indicate this is an update
      newPhrase: newPhrase.trim(),
      messageId: this.message.id || '',
      componentId: componentId
    });
  }


  finishEditingComponent(componentId: string): void {
    // Update the component flag directly (primary source of truth)
    this.updateComponentFlag(componentId, component => {
      component.isEditing = false;
      delete component.editingValue;
    });

    // Keep legacy maps in sync for backward compatibility
    this.editingComponents[componentId] = false;
    delete this.editingComponentValues[componentId];
    this.computeDisplayValues(componentId);
  }

  cancelEditingComponent(componentId: string): void {
    // Update the component flag directly (primary source of truth)
    this.updateComponentFlag(componentId, component => {
      component.isEditing = false;
      delete component.editingValue;
    });

    // Keep legacy maps in sync for backward compatibility
    this.editingComponents[componentId] = false;
    delete this.editingComponentValues[componentId];
    this.computeDisplayValues(componentId);
  }

  // The backend returns the updated ChatMessage with the new foods structure

  // Handle adding new food from child component
  
  onFoodAdded(phrase: string): void {
    // Handle the new food phrase submission
    this.phraseEditRequested.emit({
      originalPhrase: '',
      newPhrase: phrase,
      messageId: this.message.id || ''
    });
    this.isAddingFood = false;
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
    const component = this.findComponentById(componentId);
    const isCurrentlyShowing = component?.showingMoreOptions ?? !!this.showingMoreOptionsFor[componentId];

    if (isCurrentlyShowing) {
      // Hide more options
      this.updateComponentFlag(componentId, component => {
        component.showingMoreOptions = false;
      });
      // Keep legacy map in sync for backward compatibility
      this.showingMoreOptionsFor[componentId] = false;
      return;
    }

    const hasOptions = (component?.moreOptions?.length ?? this.moreOptionsFor[componentId]?.length) ?? 0;
    if (hasOptions > 0) {
      // Already have options, just show them
      this.updateComponentFlag(componentId, component => {
        component.showingMoreOptions = true;
      });
      // Keep legacy map in sync for backward compatibility
      this.showingMoreOptionsFor[componentId] = true;
      return;
    }

    // Need to fetch more options
    await this.fetchMoreOptions(componentId);
  }

  // Fetch more options from the backend
  async fetchMoreOptions(componentId: string): Promise<void> {
    try {
      // Set loading state
      this.updateComponentFlag(componentId, component => {
        component.loadingMoreOptions = true;
      });
      // Keep legacy map in sync for backward compatibility
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
        // Set success state
        this.updateComponentFlag(componentId, component => {
          component.showingMoreOptions = true;
          component.moreOptions = response.alternatives;
        });
        // Keep legacy maps in sync for backward compatibility
        this.moreOptionsFor[componentId] = response.alternatives;
        this.showingMoreOptionsFor[componentId] = true;
      } else {
        await this.showErrorToast('No additional options found');
      }
    } catch (error) {
      await this.showErrorToast('Failed to fetch more options');
    } finally {
      // Clear loading state
      this.updateComponentFlag(componentId, component => {
        component.loadingMoreOptions = false;
      });
      // Keep legacy map in sync for backward compatibility
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
    this.updateComponentFlag(componentId, component => {
      component.showingMoreOptions = false;
    });
    // Keep legacy map in sync for backward compatibility
    this.showingMoreOptionsFor[componentId] = false;
  }

  // Track recent dropdown open calls to prevent multiple triggers
  private recentDropdownOpens: { [componentId: string]: number } = {};

  // Handle dropdown will open event - this is the ONLY place instant search should be triggered
  async onDropdownWillOpen(componentId: string): Promise<void> {
    // Throttle multiple calls within 500ms
    const now = Date.now();
    const lastCall = this.recentDropdownOpens[componentId] || 0;
    if (now - lastCall < 500) {
      return;
    }
    this.recentDropdownOpens[componentId] = now;

    const component = this.findComponentById(componentId);
    const hasOptions = (component?.moreOptions?.length ?? this.moreOptionsFor[componentId]?.length) ?? 0;
    const isLoading = component?.loadingInstantOptions ?? !!this.loadingInstantOptionsFor[componentId];

    if (!hasOptions && !isLoading) {
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

      // Set loading state and options
      this.updateComponentFlag(componentId, component => {
        component.loadingInstantOptions = true;
        component.moreOptions = [loadingMatch];
      });
      // Keep legacy maps in sync for backward compatibility
      this.moreOptionsFor[componentId] = [loadingMatch];
      this.loadingInstantOptionsFor[componentId] = true;

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
      // Set loading state
      this.updateComponentFlag(componentId, component => {
        component.loadingInstantOptions = true;
      });
      // Keep legacy map in sync for backward compatibility
      this.loadingInstantOptionsFor[componentId] = true;

      const originalPhrase = this.getOriginalPhraseForComponent(componentId);

      if (!originalPhrase) {
        return;
      }

      const request = new GetInstantAlternativesRequest({
        originalPhrase: originalPhrase,
        componentId: componentId,
        localDateKey: this.dateService.getSelectedDate()
      });

      const response = await this.foodSelectionService.getInstantAlternatives(request).toPromise();

      if (response?.isSuccess && response.alternatives) {
        // Set success state
        this.updateComponentFlag(componentId, component => {
          component.moreOptions = response.alternatives;
        });
        // Keep legacy map in sync for backward compatibility
        this.moreOptionsFor[componentId] = response.alternatives;
      } else {
        // Remove loading placeholder
        this.updateComponentFlag(componentId, component => {
          component.moreOptions = [];
        });
        // Keep legacy map in sync for backward compatibility
        this.moreOptionsFor[componentId] = [];
      }
    } catch (error) {
      // Remove loading placeholder on error
      this.updateComponentFlag(componentId, component => {
        component.moreOptions = [];
      });
      // Keep legacy map in sync for backward compatibility
      this.moreOptionsFor[componentId] = [];
    } finally {
      // Clear loading state
      this.updateComponentFlag(componentId, component => {
        component.loadingInstantOptions = false;
      });
      // Keep legacy map in sync for backward compatibility
      this.loadingInstantOptionsFor[componentId] = false;
      this.cdr.detectChanges();
    }
  }

  // Event handlers for child component integration

  handleFoodSelected(event: {componentId: string, food: ComponentMatch}): void {
    const foodId = event.food.providerFoodId;
    if (foodId) {
      this.onFoodSelected(event.componentId, foodId);
    }
  }

  // Add food methods
  startAddingFood(): void {
    this.isAddingFood = true;
  }

  cancelAddingFood(): void {
    this.isAddingFood = false;
  }

  
}

import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, ChangeDetectorRef, ViewChild, NO_ERRORS_SCHEMA, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { addIcons } from 'ionicons';
import { createOutline, chevronUpOutline, chevronDownOutline, trashOutline, send, addCircleOutline, ellipsisHorizontal } from 'ionicons/icons';
import { ComponentMatch, ComponentServing, SubmitServingSelectionRequest, UserSelectedServing, SubmitEditServingSelectionRequest, MessageRoleTypes, NutritionAmbitionApiService, SearchFoodPhraseRequest, UserEditOperation, EditFoodSelectionType, LogMealToolResponse, GetInstantAlternativesRequest, GetInstantAlternativesResponse, ServingIdentifier } from 'src/app/services/nutrition-ambition-api.service';
import { SearchFoodComponent } from './search-food/search-food.component';
import { FoodSelectionActionsComponent } from './food-selection-actions/food-selection-actions.component';
import { FoodComponent } from './food/food.component';
import { DisplayMessage } from 'src/app/models/display-message';
import { ComponentDisplay, FoodDisplay } from 'src/app/models/food-selection-display';
import { ToastService } from 'src/app/services/toast.service';
import { DateService } from 'src/app/services/date.service';
import { FoodSelectionService } from 'src/app/services/food-selection.service';
import { IonIcon } from '@ionic/angular/standalone';
import { ServingIdentifierUtil } from './serving-identifier.util';

@Component({
  selector: 'app-food-selection',
  templateUrl: './food-selection.component.html',
  styleUrls: ['./food-selection.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, SearchFoodComponent, FoodSelectionActionsComponent, FoodComponent, IonIcon],
  schemas: [NO_ERRORS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FoodSelectionComponent implements OnInit, OnChanges {
  @Input() message!: DisplayMessage;
  @Input() isEditingPhrase: boolean = false;
  @Output() selectionConfirmed = new EventEmitter<SubmitServingSelectionRequest>();
  @Output() editConfirmed = new EventEmitter<SubmitEditServingSelectionRequest>();
  @Output() selectionCanceled = new EventEmitter<void>();
  @Output() updatedMessage = new EventEmitter<DisplayMessage>();
  @Output() phraseEditRequested = new EventEmitter<{originalPhrase: string, newPhrase: string, messageId: string, componentId?: string}>();

  @ViewChild(SearchFoodComponent) addFoodComponent?: SearchFoodComponent;

  isReadOnly = false;
  isEditMode = false;
  isAddingFood = false;

  isSubmitting = false;
  isCanceling = false;
  private cancelTimeout: any = null;
  


  // Track edit operations for the new backend structure
  editOperations: UserEditOperation[] = [];
  removedFoods: Set<string> = new Set(); // Track foods removed via RemoveFood operation
  
  // Track which component was being edited to re-expand it after update
  private editingComponentId: string | null = null;


  // Hot-path caches to avoid repeated deep scans - TODO: Remove these in favor of direct component access
  private selectedFoodByComponentId: Map<string, ComponentMatch> = new Map();
  private selectedServingIdByComponentId: Map<string, string> = new Map();
  
  
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
    this.computeAllFoods();
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
      this.computeAllFoods();
    }
    if (changes['isReadOnly'] && this.isReadOnly) this.isSubmitting = false;
  }



  toggleExpansion(componentId: string): void {
    // Get current state from component
    const component = this.findComponentById(componentId);
    const currentState = component?.isExpanded ?? false;
    const newState = !currentState;

    // Set expansion state
    const foodIndex = this.findFoodIndexForComponent(componentId);
    if (foodIndex >= 0) {
      this.onComponentChanged(foodIndex, componentId, { isExpanded: newState });
    }
  }

  isExpanded(componentId: string): boolean {
    const component = this.findComponentById(componentId);
    return component?.isExpanded ?? false;
  }

  // Food-level expansion methods
  toggleFoodExpansion(foodIndex: number): void {
    const food = this.computedFoods[foodIndex];
    if (food) {
      const newFood = new FoodDisplay({
        ...food,
        isEditingExpanded: !food.isEditingExpanded
      });
      this.onFoodChanged(foodIndex, newFood);
    }
  }

  isFoodExpanded(foodIndex: number): boolean {
    const food = this.computedFoods[foodIndex];
    return food?.isEditingExpanded ?? false;
  }

  // Get components for a specific food
  getComponentsForFood(food: any): any[] {
    if (!food?.components) return [];

    // Return empty if the food has been removed (check both new flag and legacy set)
    if ((food as any).isRemoved || (food.id && this.removedFoods.has(food.id))) {
      return [];
    }

    const activeComponents = food.components.filter((component: any) => component.id && !(component as any).isRemoved);
    const isSingleComponentFood = activeComponents.length === 1;
    const parentQuantity = food.quantity || 1;

    // Filter out removed components and create ComponentDisplay objects with editing state
    return activeComponents.map((component: any) => {
        const componentDisplay = new ComponentDisplay({
          ...component,
          // Use component state directly (immutable pattern)
          isEditing: component.isEditing ?? false,
          editingValue: component.editingValue ?? '',
          isExpanded: component.isExpanded ?? false,
          isSearching: (component as any).isSearching ?? false,
          showingMoreOptions: component.showingMoreOptions ?? false,
          loadingMoreOptions: component.loadingMoreOptions ?? false,
          loadingInstantOptions: component.loadingInstantOptions ?? false,
          moreOptions: component.moreOptions ?? []
        });
        return {
          componentId: component.id,
          component: componentDisplay,
          isSingleComponentFood: isSingleComponentFood,
          parentQuantity: parentQuantity
        };
      });
  }

  // All remaining components across foods (excludes removed foods/components)
  get availableComponents(): any[] {
    if (!this.message?.logMealToolResponse?.foods) return [];
    const result: any[] = [];
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
  getFoodTotalCaloriesFromComponents(food: any, foodComponents: any[]): number {
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
    const food = this.computedFoods[foodIndex];
    if (!food) return;

    const currentState = food.isEditingExpanded ?? false;
    const newState = !currentState;

    // Update using immutable pattern
    const newFood = new FoodDisplay({
      ...food,
      isEditingExpanded: newState,
      editingQuantity: newState ? (food.quantity || 1) : undefined
    });

    this.onFoodChanged(foodIndex, newFood);

    // Recompute all foods to reflect the change
    this.computeAllFoods();
  }

  isFoodEditingExpanded(foodIndex: number): boolean {
    const food = this.computedFoods[foodIndex];
    if (!food) return false;

    // Auto-expand if any component in this food is being edited
    if (food.components) {
      for (const component of food.components) {
        if (component.matches && component.matches.length > 0 && (component.matches[0] as any).isEditingPhrase) {
          return true;
        }
      }
    }

    // Check food display property
    return food.isEditingExpanded ?? false;
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
    const food = this.computedFoods[foodIndex];
    if (!food) return;

    // Get quantity from food display property
    const newQuantity = food.editingQuantity;
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
      // Trigger recomputation which creates new array references for OnPush components
      this.computeAllFoods();
    }
  }

  onFoodQuantityChange(foodIndex: number, newQuantity: number): void {
    const food = this.message.logMealToolResponse?.foods?.[foodIndex];
    if (food) {
      // Update the food display property directly (primary source of truth)
      (food as any).editingQuantity = newQuantity;
    }

    this.updateFoodQuantity(foodIndex);
  }

  onFoodActionRequested(event: { action: string; payload: any }): void {
    switch (event.action) {
      case 'toggleFoodExpansion':
        this.toggleFoodEditing(event.payload);
        break;
      case 'quantityChanged':
        this.onFoodQuantityChange(event.payload.foodIndex, event.payload.quantity);
        break;
      case 'removeFood':
        this.removeFood(event.payload);
        break;
      case 'toggleComponentExpansion':
        this.toggleExpansion(event.payload);
        break;
      case 'servingSelected':
        this.onServingSelected(event.payload.componentId, event.payload.servingId);
        break;
      case 'servingQuantityChanged':
        this.onServingQuantityChanged(event.payload.componentId, event.payload.servingId, event.payload.quantity);
        break;
      case 'editStarted':
        this.startEditingComponent(event.payload);
        break;
      case 'editCanceled':
        this.cancelEditingComponent(event.payload);
        break;
      case 'editConfirmed':
        this.sendUpdatedComponent(event.payload);
        break;
      case 'removeComponent':
        this.removeItem(event.payload);
        break;
      case 'moreOptionsRequested':
        this.toggleMoreOptions(event.payload);
        break;
      case 'foodSelected':
        this.handleFoodSelected(event.payload);
        break;
      case 'instantOptionsRequested':
        this.onDropdownWillOpen(event.payload.componentId);
        break;
    }
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
    for (const food of this.computedFoods) {
      if (food.components) {
        for (const component of food.components) {
          if (component.id === componentId) {
            return component;
          }
        }
      }
    }
    return null;
  }

  private getFoodForComponent(componentId: string): any {
    for (const food of this.computedFoods) {
      if (food.components?.some(c => c.id === componentId)) {
        return food;
      }
    }
    return null;
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
        // Set the default serving ID for display
        const originalSid = match.servings?.[0]?.id;
        if (originalSid) {
          (match as any).selectedServingId = originalSid;
        }
      }
    });

    // In edit mode, track the operation
    if (this.isEditMode) {
      const selectedMatch = component.matches.find((match: any) => match.providerFoodId === foodId);
      const servingIdentifier = (selectedMatch as any)?.selectedServingId;
      this.addEditOperation(new UserEditOperation({
        action: EditFoodSelectionType.UpdateServing,
        componentId: componentId,
        providerFoodId: foodId,
        servingId: servingIdentifier
      }));
    }

    // Update caches for this component
    const selectedMatch = component.matches.find((match: any) => match.providerFoodId === foodId) as ComponentMatch | undefined;
    if (selectedMatch) {
      this.selectedFoodByComponentId.set(componentId, selectedMatch);
      const sid = (selectedMatch as any)?.selectedServingId ?? selectedMatch.servings?.[0]?.id;
      if (sid) this.selectedServingIdByComponentId.set(componentId, sid);
      
    }
  }

  onServingSelected(componentId: string, servingId: string): void {
    const selectedFood = this.getSelectedFood(componentId);
    if (selectedFood) {
      // Find the actual ServingIdentifier object from the serving data
      const selectedServing = (selectedFood as any)?.servings?.find((s: any) => s.id === servingId);
      const servingIdentifier = selectedServing?.servingId;

      // Update selectedServingId with the ServingIdentifier object
      (selectedFood as any).selectedServingId = servingIdentifier;

      // Keep cache in sync (still using string for cache lookup)
      this.selectedServingIdByComponentId.set(componentId, servingId);

      // Update the FoodSelectionService with the new selection (using the new GUID id)
      this.foodSelectionService.selectServing(componentId, servingId);


      // Trigger recomputation which creates new array references for OnPush components
      this.computeAllFoods();

      // In edit mode, track the operation
      if (this.isEditMode && servingIdentifier) {
        this.addEditOperation(new UserEditOperation({
          action: EditFoodSelectionType.UpdateServing,
          componentId: componentId,
          providerFoodId: (selectedFood as any)?.providerFoodId,
          servingId: servingIdentifier
        }));
      }
    }
  }

  onServingQuantityChanged(componentId: string, servingId: string, quantity: number): void {
    console.log('🔧 Quantity changed:', { componentId, servingId, quantity });

    // CRITICAL: Update the quantity in the food-selection service first
    this.foodSelectionService.updateServingQuantity(componentId, servingId, quantity);
    console.log('🔧 Updated service quantity');

    // Recompute to update food-level macros with new array references for OnPush components
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
   * Gets the serving ID for backend operations
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
    const selectedServingId = (match as any)?.selectedServingId;
    return match?.servings?.find((s: any) => {
      if (!s?.servingId || !selectedServingId) return false;
      return ServingIdentifierUtil.areEqual(s.servingId, selectedServingId);
    });
  }

  // TrackBy function to prevent DOM reuse issues
  trackByServingId(index: number, serving: ComponentServing): string {
    return ServingIdentifierUtil.toUniqueString(serving.servingId) || `${index}`;
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

              const servingIdentifier = selectedServing.servingId;
              req.selections.push(new UserSelectedServing({
                componentId: component.id,
                originalText: (((component as any)?.key) ?? (selectedFood as any)?.originalText) || '',
                provider: (selectedFood as any)?.provider ?? 'nutritionix',
                providerFoodId: (selectedFood as any)?.providerFoodId,
                servingId: servingIdentifier,
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
    const userServingId = serving.servingId ? new ServingIdentifier({
      ...serving.servingId,
      servingType: 'user'
    }) : undefined;

    const userServing = new ComponentServing({
      ...serving,
      servingId: userServingId,
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
        // Extract component from componentData
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




  // Helper to recompute food components for a component
  private recomputeComponentAndFood(componentId: string): void {
    // Recompute all foods since component changed
    this.computeAllFoods();
  }

  // Compute all foods as FoodDisplay objects with embedded state
  private computeAllFoods(): void {
    const rawFoods = this.message?.logMealToolResponse?.foods || [];

    // Save current UI state before recreation
    const currentUIState = this.saveCurrentUIState();

    // Create a completely new array to trigger Angular change detection
    const newComputedFoods = rawFoods.map((food, foodIndex) => {
      // Transform components to ComponentDisplay objects, preserving UI state
      const transformedComponents = food.components?.map((component: any) => {
        const currentComponentState = currentUIState.components[component.id] || {};
        return new ComponentDisplay({
          ...component,
          // Preserve UI state flags if they exist, otherwise use defaults
          isSearching: currentComponentState.isSearching || false,
          isEditing: currentComponentState.isEditing || false,
          isExpanded: currentComponentState.isExpanded || false,
          editingValue: currentComponentState.editingValue || '',
          showingMoreOptions: currentComponentState.showingMoreOptions || false,
          loadingMoreOptions: currentComponentState.loadingMoreOptions || false,
          loadingInstantOptions: currentComponentState.loadingInstantOptions || false,
          moreOptions: currentComponentState.moreOptions || [],
          isRemoved: currentComponentState.isRemoved || false
        });
      }) || [];

      const currentFoodState = food.id ? currentUIState.foods[food.id] || {} : {};
      const foodDisplay = new FoodDisplay({
        ...food,
        components: transformedComponents,
        isEditingExpanded: currentFoodState.isEditingExpanded !== undefined
          ? currentFoodState.isEditingExpanded
          : this.isFoodEditingExpanded(foodIndex)
      });

      return foodDisplay;
    });

    // Create new array reference to trigger change detection
    this.computedFoods = [...newComputedFoods];
  }

  // Save current UI state before recreation
  private saveCurrentUIState(): { foods: any; components: any } {
    const foodState: any = {};
    const componentState: any = {};

    for (const food of this.computedFoods) {
      if (food.id) {
        foodState[food.id] = {
          isEditingExpanded: food.isEditingExpanded
        };
      }

      if (food.components) {
        for (const component of food.components) {
          if (component.id) {
            componentState[component.id] = {
              isSearching: component.isSearching,
              isEditing: component.isEditing,
              isExpanded: component.isExpanded,
              editingValue: component.editingValue,
              showingMoreOptions: component.showingMoreOptions,
              loadingMoreOptions: component.loadingMoreOptions,
              loadingInstantOptions: component.loadingInstantOptions,
              moreOptions: component.moreOptions,
              isRemoved: component.isRemoved
            };
          }
        }
      }
    }

    return { foods: foodState, components: componentState };
  }

  // Helper methods for template
  hasVisibleComponents(food: any): boolean {
    return this.getVisibleComponents(food).length > 0;
  }

  isMultiComponentFood(food: any): boolean {
    return this.getVisibleComponents(food).length > 1;
  }

  getVisibleComponents(food: any): any[] {
    if (!food?.components) return [];
    return food.components.filter((component: any) => !component.isRemoved);
  }

  trackByComponent(index: number, component: any): string {
    return component.id || index.toString();
  }

  // IMMUTABLE UPDATE METHODS - As specified in the refactoring plan

  /**
   * Core immutable update method for food changes
   * Creates new array reference with updated food at specific index
   */
  onFoodChanged(foodIndex: number, newFood: FoodDisplay): void {
    const currentFoods = [...this.computedFoods];
    currentFoods[foodIndex] = newFood;
    this.computedFoods = currentFoods;
  }

  /**
   * Immutable component removal method
   * Creates new food object with component filtered out
   */
  onComponentRemoved(foodIndex: number, componentId: string): void {
    const food = this.computedFoods[foodIndex];
    const newFood = new FoodDisplay({
      ...food,
      components: food.components?.filter(c => c.id !== componentId) || []
    });
    this.onFoodChanged(foodIndex, newFood);
  }

  /**
   * Immutable component update method
   * Creates new food object with updated component
   */
  onComponentChanged(foodIndex: number, componentId: string, changes: any): void {
    const food = this.computedFoods[foodIndex];
    const newFood = new FoodDisplay({
      ...food,
      components: food.components?.map(c =>
        c.id === componentId ? { ...c, ...changes } : c
      ) || []
    });
    this.onFoodChanged(foodIndex, newFood);
  }

  /**
   * Helper method to find food index containing a specific component
   */
  private findFoodIndexForComponent(componentId: string): number {
    for (let i = 0; i < this.computedFoods.length; i++) {
      const food = this.computedFoods[i];
      if (food.components?.some(c => c.id === componentId)) {
        return i;
      }
    }
    return -1;
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

      // Mark component as removed
      const foodIndex = this.findFoodIndexForComponent(componentId);
      if (foodIndex >= 0) {
        this.onComponentChanged(foodIndex, componentId, { isRemoved: true });
      }

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
              // Restore component by clearing isRemoved flag
              const foodIndex = this.findFoodIndexForComponent(componentId);
              if (foodIndex >= 0) {
                this.onComponentChanged(foodIndex, componentId, { isRemoved: false });
              }

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
    const editedId = ServingIdentifierUtil.toUniqueString(selected.servingId);

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
        const sId = ServingIdentifierUtil.toUniqueString(s.servingId);
        if (sId === editedId) {
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
      const sId = ServingIdentifierUtil.toUniqueString(s.servingId);
      (s as any).isBestMatch = sId === editedId;
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
      this.selectionCanceled.emit();
      this.cancelTimeout = null;
      // Note: isCanceling will be reset by parent when API response comes back
    }, 5000);
    
    // Listen for toast dismissal (if user dismisses manually)
    toast.onDidDismiss().then((result) => {
      // If toast was dismissed but not by undo button, proceed with cancellation
      if (result.role !== 'cancel' && this.isCanceling && this.cancelTimeout) {
        // User dismissed toast manually - proceed with cancellation immediately
        clearTimeout(this.cancelTimeout);
        this.selectionCanceled.emit();
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
    return component?.isEditing ?? false;
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

    // Use component state directly
    return false;
  }

  clearComponentSearching(componentId: string): void {
    // With immutable pattern, this is handled by component state
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
    // Start editing component
    const foodIndex = this.findFoodIndexForComponent(componentId);
    if (foodIndex >= 0) {
      this.onComponentChanged(foodIndex, componentId, {
        isEditing: true,
        editingValue: this.getSearchTextOnly(componentId)
      });
    }


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

    // Get editing value from component if available
    if (component?.editingValue !== undefined) {
      return component.editingValue;
    }

    // Fall back to original component key only if no editing value exists
    return component?.key || '';
  }



  updateEditingComponent(componentId: string, event: any): void {
    const newValue = event.target.value;

    // Update editing value
    const foodIndex = this.findFoodIndexForComponent(componentId);
    if (foodIndex >= 0) {
      this.onComponentChanged(foodIndex, componentId, {
        editingValue: newValue
      });
    }

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

    // Get editing value from component
    const currentValue = component?.editingValue ?? '';
    if (!currentValue) {
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
      // Old pattern: just componentId, get newPhrase from component
      componentId = eventOrComponentId;
      const component = this.findComponentById(componentId);
      newPhrase = component?.editingValue || '';
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
    // Clear editing state
    const foodIndex = this.findFoodIndexForComponent(componentId);
    if (foodIndex >= 0) {
      this.onComponentChanged(foodIndex, componentId, {
        isEditing: false,
        editingValue: undefined
      });
    }
  }

  cancelEditingComponent(componentId: string): void {
    // Clear editing state
    const foodIndex = this.findFoodIndexForComponent(componentId);
    if (foodIndex >= 0) {
      this.onComponentChanged(foodIndex, componentId, {
        isEditing: false,
        editingValue: undefined
      });
    }
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
    this.selectedFoodByComponentId.clear();
    this.selectedServingIdByComponentId.clear();

    const foods = this.message?.logMealToolResponse?.foods || [];
    for (const food of foods) {
      const components = food.components || [];
      for (const component of components) {
        const cid = component?.id;
        if (!cid) continue;

        const matches: any[] = component?.matches || [];
        if (matches.length) {
          const selected: ComponentMatch = (matches.find(m => (m as any).isBestMatch) || matches[0]) as ComponentMatch;
          this.selectedFoodByComponentId.set(cid, selected);
          const fallbackServingId = selected.servings?.[0]?.servingId || null;
          const originalServingIdentifier = (selected as any)?.selectedServingId ?? fallbackServingId;
          if (originalServingIdentifier) {
            // Set the ServingIdentifier object for backend operations
            (selected as any).selectedServingId = originalServingIdentifier;
            // For the cache, we need a string key - use the first serving's id if available
            const stringId = selected.servings?.[0]?.id || ServingIdentifierUtil.toUniqueString(originalServingIdentifier);
            this.selectedServingIdByComponentId.set(cid, stringId);
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
    const isCurrentlyShowing = component?.showingMoreOptions ?? false;

    if (isCurrentlyShowing) {
      // Hide more options
      const foodIndex = this.findFoodIndexForComponent(componentId);
      if (foodIndex >= 0) {
        this.onComponentChanged(foodIndex, componentId, {
          showingMoreOptions: false
        });
      }
      return;
    }

    const hasOptions = component?.moreOptions?.length ?? 0;
    if (hasOptions > 0) {
      // Show more options
      const foodIndex = this.findFoodIndexForComponent(componentId);
      if (foodIndex >= 0) {
        this.onComponentChanged(foodIndex, componentId, {
          showingMoreOptions: true
        });
      }
      return;
    }

    // Need to fetch more options
    await this.fetchMoreOptions(componentId);
  }

  // Fetch more options from the backend
  async fetchMoreOptions(componentId: string): Promise<void> {
    try {
      // Set loading state
      const foodIndex = this.findFoodIndexForComponent(componentId);
      if (foodIndex >= 0) {
        this.onComponentChanged(foodIndex, componentId, {
          loadingMoreOptions: true
        });
      }

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
        const foodIndex = this.findFoodIndexForComponent(componentId);
        if (foodIndex >= 0) {
          this.onComponentChanged(foodIndex, componentId, {
            showingMoreOptions: true,
            moreOptions: response.alternatives
          });
        }
      } else {
        await this.showErrorToast('No additional options found');
      }
    } catch (error) {
      await this.showErrorToast('Failed to fetch more options');
    } finally {
      // Clear loading state
      const foodIndex = this.findFoodIndexForComponent(componentId);
      if (foodIndex >= 0) {
        this.onComponentChanged(foodIndex, componentId, {
          loadingMoreOptions: false
        });
      }
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
    const foodIndex = this.findFoodIndexForComponent(componentId);
    if (foodIndex >= 0) {
      this.onComponentChanged(foodIndex, componentId, {
        showingMoreOptions: false
      });
    }
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
    const hasOptions = component?.moreOptions?.length ?? 0;
    const isLoading = component?.loadingInstantOptions ?? false;

    if (!hasOptions && !isLoading) {
      const loadingMatch = new ComponentMatch({
        providerFoodId: 'loading',
        displayName: 'Loading...',
        brandName: '',
        originalText: '',
        description: '',
        rank: 999,
        servings: []
      });

      // Set loading state and options
      const foodIndex = this.findFoodIndexForComponent(componentId);
      if (foodIndex >= 0) {
        this.onComponentChanged(foodIndex, componentId, {
          loadingInstantOptions: true,
          moreOptions: [loadingMatch]
        });
      }

      await this.fetchInstantOptions(componentId);
    }
  }
  

  // Get display matches including loading state
  getDisplayMatches(componentId: string): ComponentMatch[] {
    const component = this.findComponentById(componentId);
    if (!component?.matches) return [];

    const baseMatches = component.matches || [];
    const instantOptions = component.moreOptions || [];
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
      const foodIndex = this.findFoodIndexForComponent(componentId);
      if (foodIndex >= 0) {
        this.onComponentChanged(foodIndex, componentId, {
          loadingInstantOptions: true
        });
      }

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
        const foodIndex = this.findFoodIndexForComponent(componentId);
        if (foodIndex >= 0) {
          this.onComponentChanged(foodIndex, componentId, {
            moreOptions: response.alternatives
          });
        }
      } else {
        // Remove loading placeholder
        const foodIndex = this.findFoodIndexForComponent(componentId);
        if (foodIndex >= 0) {
          this.onComponentChanged(foodIndex, componentId, {
            moreOptions: []
          });
        }
      }
    } catch (error) {
      // Remove loading placeholder on error
      const foodIndex = this.findFoodIndexForComponent(componentId);
      if (foodIndex >= 0) {
        this.onComponentChanged(foodIndex, componentId, {
          moreOptions: []
        });
      }
    } finally {
      // Clear loading state
      const foodIndex = this.findFoodIndexForComponent(componentId);
      if (foodIndex >= 0) {
        this.onComponentChanged(foodIndex, componentId, {
          loadingInstantOptions: false
        });
      }
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

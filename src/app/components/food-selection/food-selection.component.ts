import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonButton, IonRadioGroup, IonRadio, IonSelect, IonSelectOption, IonIcon, IonGrid, IonRow, IonCol } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { createOutline, chevronUpOutline, chevronDownOutline, trashOutline, send, addCircleOutline } from 'ionicons/icons';
import { ComponentMatch, ComponentServing, SubmitServingSelectionRequest, UserSelectedServing, SubmitEditServingSelectionRequest, MessageRoleTypes, NutritionAmbitionApiService, SearchFoodPhraseRequest, UserEditOperation, EditFoodSelectionType, LogMealToolResponse } from 'src/app/services/nutrition-ambition-api.service';
import { ServingQuantityInputComponent } from 'src/app/components/serving-quantity-input.component/serving-quantity-input.component';
import { DisplayMessage } from 'src/app/models/display-message';
import { ToastService } from 'src/app/services/toast.service';
import { DateService } from 'src/app/services/date.service';

@Component({
  selector: 'app-food-selection',
  templateUrl: './food-selection.component.html',
  styleUrls: ['./food-selection.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonButton, IonRadioGroup, IonRadio, IonSelect, IonSelectOption, IonIcon, IonGrid, IonRow, IonCol, ServingQuantityInputComponent]
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

  // Hot-path caches to avoid repeated deep scans
  private componentById: Map<string, any> = new Map();
  private foodForComponentId: Map<string, any> = new Map();
  private selectedFoodByComponentId: Map<string, ComponentMatch> = new Map();
  private selectedServingIdByComponentId: Map<string, string> = new Map();

  constructor(
    private toastService: ToastService, 
    private cdr: ChangeDetectorRef,
    private apiService: NutritionAmbitionApiService,
    private dateService: DateService
  ) {
    addIcons({ createOutline, chevronUpOutline, chevronDownOutline, trashOutline, send, addCircleOutline });
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
    const sid = (selected as any)?.selectedServingId ?? selected.servings?.[0]?.fatSecretServingId;
    if (sid) this.selectedServingIdByComponentId.set(componentId, sid);
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
    const component = this.findComponentById(componentId);
    if (!component?.matches) return;

    // Clear isBestMatch on all matches, then set it on the selected one
    component.matches.forEach((match: any) => {
      (match as any).isBestMatch = match.fatSecretFoodId === foodId;
      if ((match as any).isBestMatch) {
        // Set default serving on the selected match
        (match as any).selectedServingId = match.servings?.[0]?.fatSecretServingId;
      }
    });

    // In edit mode, track the operation
    if (this.isEditMode) {
      const selectedMatch = component.matches.find((match: any) => match.fatSecretFoodId === foodId);
      this.addEditOperation(new UserEditOperation({
        action: EditFoodSelectionType.UpdateServing,
        componentId: componentId,
        fatSecretFoodId: foodId,
        fatSecretServingId: (selectedMatch as any)?.selectedServingId
      }));
    }

    // Update caches for this component
    const selectedMatch = component.matches.find((match: any) => match.fatSecretFoodId === foodId) as ComponentMatch | undefined;
    if (selectedMatch) {
      this.selectedFoodByComponentId.set(componentId, selectedMatch);
      const sid = (selectedMatch as any)?.selectedServingId ?? selectedMatch.servings?.[0]?.fatSecretServingId;
      if (sid) this.selectedServingIdByComponentId.set(componentId, sid);
    }
  }

  onServingSelected(componentId: string, servingId: string): void {
    const selectedFood = this.getSelectedFood(componentId);
    if (selectedFood) {
      // Update selectedServingId directly on the selected match
      (selectedFood as any).selectedServingId = servingId;

      // Keep cache in sync
      this.selectedServingIdByComponentId.set(componentId, servingId);

      // In edit mode, track the operation
      if (this.isEditMode) {
        this.addEditOperation(new UserEditOperation({
          action: EditFoodSelectionType.UpdateServing,
          componentId: componentId,
          externalFoodId: (selectedFood as any)?.externalFoodId ?? (selectedFood as any)?.fatSecretFoodId,
          fatSecretFoodId: (selectedFood as any)?.fatSecretFoodId, // back-compat
          externalServingId: servingId,
          fatSecretServingId: servingId // back-compat
        }));
      }
    }
  }

  getSelectedServingId(componentId: string): string | undefined {
    const cached = this.selectedServingIdByComponentId.get(componentId);
    if (cached) return cached;
    const selectedFood = this.getSelectedFood(componentId);
    const firstServingId = (sf: any) => (sf?.servings?.[0]?.externalServingId ?? sf?.servings?.[0]?.fatSecretServingId);
    const sid = (selectedFood as any)?.selectedServingId ?? firstServingId(selectedFood);
    if (sid) this.selectedServingIdByComponentId.set(componentId, sid);
    return sid;
  }

  getSelectedServing(componentId: string): ComponentServing | null {
    const food = this.getSelectedFood(componentId);
    const id = this.getSelectedServingId(componentId);
    return food?.servings?.find((s: any) => s?.externalServingId === id || s?.fatSecretServingId === id) || null;
  }

  // Getter to always derive the selected serving for a food match
  getSelectedServingForFood(match: ComponentMatch): ComponentServing | undefined {
    return match?.servings?.find((s: any) => s?.externalServingId === (match as any)?.selectedServingId || s?.fatSecretServingId === (match as any)?.selectedServingId);
  }

  // TrackBy function to prevent DOM reuse issues
  trackByServingId(index: number, serving: ComponentServing): string {
    return (serving as any).externalServingId || (serving as any).fatSecretServingId || `${index}`;
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
            const servingId = this.getSelectedServingId(component.id);
            
            if (!(selectedFood as any)?.externalFoodId && !(selectedFood as any)?.fatSecretFoodId || !servingId) {
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
            const servingId = this.getSelectedServingId(component.id);
            const selectedServing = this.getSelectedServing(component.id);
            
            if (((selectedFood as any)?.externalFoodId || (selectedFood as any)?.fatSecretFoodId) && servingId && selectedServing) {
              const displayQuantity = this.getEffectiveQuantity(component.id, selectedServing);
              
              req.selections.push(new UserSelectedServing({
                componentId: component.id,
                originalText: (((component as any)?.key) ?? (selectedFood as any)?.originalText) || '',
                provider: (selectedFood as any)?.provider ?? 'nutritionix',
                externalFoodId: (selectedFood as any)?.externalFoodId ?? (selectedFood as any)?.fatSecretFoodId,
                externalServingId: servingId,
                fatSecretFoodId: (selectedFood as any)?.fatSecretFoodId,
                fatSecretServingId: servingId,
                editedQuantity: displayQuantity
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
      return `${this.fmt(dq)} ${du}`.trim();
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
  

  private nf = new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  
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
    // 0) guard
    const component = this.findComponentById(componentId);
    if (!component) return;
    
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
    
    if (!isFinite(targetMass) || targetMass <= 0) return;

    // 2) iterate all servings in the selected food and recompute scaledQuantity + display fields
    const selectedFood = this.getSelectedFood(componentId);
    if (!selectedFood?.servings) return;

    // ensure exactly one best match (the edited row)
    const editedId = selected.fatSecretServingId;

    for (const s of selectedFood.servings) {
      const mAmt = this.getMetricAmt(s);
      const hasMetric = isFinite(mAmt) && mAmt > 0;
      let scaledQ = (s as any).scaledQuantity;

      if (hasMetric) {
        // math: scaledQuantity = targetMass / metricServingAmount
        scaledQ = targetMass / mAmt;
        if (!isFinite(scaledQ) || scaledQ < 0) scaledQ = 0;
      } else {
        // fallback if no metric amount; keep existing or default to 1
        if (!isFinite(scaledQ) || scaledQ <= 0) scaledQ = 1;
      }

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
      (s as any).isBestMatch = ((s as any).externalServingId === editedId) || ((s as any).fatSecretServingId === editedId);
    }

    // ensure UI shows the edited row as selected
    if (editedId) {
      this.onServingSelected(componentId, editedId);
    }
  }

  onInlineQtyChanged(componentId: string, s: ComponentServing, newValue: number): void {
    // clamp
    const v = Math.max(0.1, Math.min(999, Number(newValue) || 0));
    (s as any).displayQuantity = v;

    // if this row isn't selected, select it now
    const currentSelected = this.getSelectedServingId(componentId);
    const sid = (s as any).externalServingId ?? (s as any).fatSecretServingId;
    if (currentSelected !== sid && sid) {
      this.onServingSelected(componentId, sid);
    }

    // For simple cases like "medium banana", just update scaledQuantity directly
    // This is a simpler approach that works for household servings
    (s as any).scaledQuantity = v;
    
    // Also update display values for this serving
    const units = this.getNumberOfUnits(s);
    (s as any).displayQuantity = v;
    (s as any).displayUnit = this.getUnitText(s);

    // In edit mode, track the operation
    if (this.isEditMode) {
      const selectedFood = this.getSelectedFood(componentId);
      const sid = (s as any).externalServingId ?? (s as any).fatSecretServingId;
      if (selectedFood && sid) {
        this.addEditOperation(new UserEditOperation({
          action: EditFoodSelectionType.UpdateServing,
          componentId: componentId,
          externalFoodId: (selectedFood as any)?.externalFoodId ?? (selectedFood as any)?.fatSecretFoodId,
          fatSecretFoodId: (selectedFood as any)?.fatSecretFoodId,
          externalServingId: sid,
          fatSecretServingId: sid,
          editedQuantity: v
        }));
      }
    }
    
    // Mark this as the best match
    const selectedFood = this.getSelectedFood(componentId);
    if (selectedFood?.servings) {
      for (const serving of selectedFood.servings) {
        (serving as any).isBestMatch = ((serving as any).externalServingId === ((s as any).externalServingId)) || (serving as any).fatSecretServingId === (s as any).fatSecretServingId;
      }
    }

    // drive the rescale from the selected row and edited quantity (for other servings)
    this.rescaleFromSelected(componentId, s, v);
    
    // Force change detection to update the UI immediately
    this.cdr.detectChanges();
  }

  onRowClicked(componentId: string, s: ComponentServing): void {
    const current = this.getSelectedServingId(componentId);
    const sid2 = (s as any).externalServingId ?? (s as any).fatSecretServingId;
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
  }

  cancelEditingComponent(componentId: string): void {
    this.editingComponents[componentId] = false;
    delete this.editingComponentValues[componentId];
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
          const sid = (selected as any)?.selectedServingId ?? selected.servings?.[0]?.fatSecretServingId;
          if (sid) this.selectedServingIdByComponentId.set(cid, sid);
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
}

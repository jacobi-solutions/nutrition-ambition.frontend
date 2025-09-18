import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, ChangeDetectorRef, ViewChild, NO_ERRORS_SCHEMA, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { addIcons } from 'ionicons';
import { createOutline, chevronUpOutline, chevronDownOutline, trashOutline, send, addCircleOutline, ellipsisHorizontal } from 'ionicons/icons';
import { ComponentMatch, ComponentServing, SubmitServingSelectionRequest, UserSelectedServing, SubmitEditServingSelectionRequest, MessageRoleTypes, NutritionAmbitionApiService, SearchFoodPhraseRequest, UserEditOperation, EditFoodSelectionType, LogMealToolResponse, GetInstantAlternativesRequest, GetInstantAlternativesResponse, ServingIdentifier } from 'src/app/services/nutrition-ambition-api.service';
import { Subject } from 'rxjs';
import { SearchFoodComponent } from './search-food/search-food.component';
import { FoodSelectionActionsComponent } from './food-selection-actions/food-selection-actions.component';
import { FoodComponent } from './food/food.component';
import { DisplayMessage } from 'src/app/models/display-message';
import { ComponentDisplay, ComponentMatchDisplay, ComponentServingDisplay, FoodDisplay } from 'src/app/models/food-selection-display';
import { ToastService } from 'src/app/services/toast.service';
import { DateService } from 'src/app/services/date.service';
import { FoodSelectionService } from 'src/app/services/food-selection.service';
import { IonIcon } from '@ionic/angular/standalone';
import { ServingIdentifierUtil } from './food-selection.util';

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
  @ViewChild(SearchFoodComponent) addFoodComponent?: SearchFoodComponent;

  isReadOnly = false;
  isEditMode = false;
  isAddingFood = false;

  isSubmitting = false;
  isCanceling = false;
  private cancelTimeout: any = null;
  // Precomputed foods array with all display state embedded - eliminates all method calls in template
  computedFoods: FoodDisplay[] = [];

  // Precomputed selection complete status
  _isSelectionComplete: boolean = false;

  constructor(
    private cdr: ChangeDetectorRef,
    private toastService: ToastService, 
    private apiService: NutritionAmbitionApiService,
    private dateService: DateService,
    private foodSelectionService: FoodSelectionService
  ) {
    addIcons({ createOutline, chevronUpOutline, chevronDownOutline, trashOutline, send, addCircleOutline, ellipsisHorizontal });
  }

  get hasPayload(): boolean {
    return !!this.computedFoods && this.computedFoods.length > 0;
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

      // Reset submitting state when message updates (after food addition/edit completes)
      this.isSubmitting = false;

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
  }

  onFoodQuantityChange(foodIndex: number, newQuantity: number): void {
    const food = this.computedFoods[foodIndex];
    if (food) {
      this.computedFoods[foodIndex] = new FoodDisplay({
        ...food, quantity: newQuantity
      });
    }

    this.computedFoods = [...this.computedFoods];
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
        this.onServingSelected(event.payload.foodIndex, event.payload.componentId, event.payload.servingId);
        break;
      case 'servingQuantityChanged':
        this.onServingQuantityChanged(event.payload.foodIndex, event.payload.componentId, event.payload.servingId, event.payload.quantity);
        break;
      case 'editFoodPhraseConfirmed':
        this.editFoodPhraseOnComponent(event.payload.foodIndex, event.payload.componentId, event.payload.newPhrase);
        break;
      case 'removeComponent':
        this.removeComponent(event.payload.foodIndex, event.payload.componentId);
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


  getSelectedFood(componentId: string): ComponentMatch | null {
    const component = this.findComponentById(componentId);
    const matches: any[] = component?.matches || [];
    if (!matches.length) return null;

    return (matches.find(m => (m as any).isBestMatch) || matches[0]) as ComponentMatch;
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


    // Update caches for this component
    const selectedMatch = component.matches.find((match: any) => match.providerFoodId === foodId) as ComponentMatch | undefined;
    if (selectedMatch) {
      // Selection state is now managed in the data structure via isBestMatch flag
      // and selectedServingId property - no need for external caches
    }
  }

  onServingSelected(foodIndex: number, componentId: string, servingId: string): void {
    const food = this.computedFoods[foodIndex];
    if (food?.components) {
      const componentIndex = food.components.findIndex((c: ComponentDisplay) => c.id === componentId);
      if (componentIndex !== -1) {
        const component = food.components[componentIndex];

        // Find which match is currently selected (isBestMatch or first)
        const selectedMatch = component.matches?.find((m: any) => m.isBestMatch) || component.matches?.[0];

        if (selectedMatch) {
          // Find the serving to get its servingId (ServingIdentifier object)
          const selectedServing = selectedMatch.servings?.find((s: ComponentServingDisplay) => s.id === servingId);
          if (selectedServing) {
            // Update the selectedServingId on the SELECTED match
            selectedMatch.selectedServingId = selectedServing.servingId;

            // Selection state is now stored directly in the selectedServingId property

            // Note: No longer need to update service since child components use data structure directly

            // Create new component reference - this triggers ngOnChanges in the child
            food.components[componentIndex] = new ComponentDisplay({...component});

            // Create new food reference to trigger food-level change detection
            this.computedFoods[foodIndex] = new FoodDisplay({...food});
            this.computedFoods = [...this.computedFoods];
          }
        }
      }
    }
  }

  onServingQuantityChanged(foodIndex: number, componentId: string, servingId: string, quantity: number): void {
    const food = this.computedFoods[foodIndex];
    if (food?.components) {
      const componentIndex = food.components.findIndex((c: ComponentDisplay) => c.id === componentId);
      if (componentIndex !== -1) {
        const component = food.components[componentIndex];
        if (component?.matches) {
          var matchIndex = component.matches.findIndex((m: ComponentMatchDisplay) => m.servings?.find((s: ComponentServingDisplay) => s.id ===servingId));
          var servingIndex = component.matches[matchIndex].servings?.findIndex((s: ComponentServingDisplay) => s.id === servingId) || 0;
          var match = component?.matches?.[matchIndex];
          var serving = match?.servings?.[servingIndex];
          if (serving) {
            serving.effectiveQuantity = quantity;
            // Create new references at both levels
            food.components[componentIndex] = new ComponentDisplay({...component});
            this.computedFoods[foodIndex] = new FoodDisplay({...food});
            this.computedFoods = [...this.computedFoods];
          }
        }
      }
    }
  }

  

  getSelectedServingId(componentId: string): string | undefined {
    const selectedFood = this.getSelectedFood(componentId);
    return (selectedFood as any)?.selectedServingId || selectedFood?.servings?.[0]?.id;
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
    
    // Use direct property lookup
    
    // Final fallback to first serving
    const firstServingId = (sf: any) => sf?.servings?.[0]?.id;
    return firstServingId(selectedFood);
  }

  getSelectedServing(componentId: string): ComponentServing | null {
    const food = this.getSelectedFood(componentId);
    const selectedServingId = this.getSelectedServingId(componentId);

    if (selectedServingId && food?.servings) {
      return food.servings.find((s: any) => s.id === selectedServingId) || null;
    }

    // Fallback: return the first serving if available
    return food?.servings?.[0] || null;
  }

  trackByFood(index: number, food: any): string {
    return food?.id || `${index}`;
  }

  // Macro helpers
  private getMacro(nutrients: { [key: string]: number } | undefined, keys: string[]): number | null {
    if (!nutrients) return null;
    for (const k of keys) if (typeof nutrients[k] === 'number') return nutrients[k];
    return null;
  }
 
  isSelectionComplete(): boolean {
    return this._isSelectionComplete;
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
    if (this.computedFoods) {
      for (const food of this.computedFoods) {
        if (food.components) {
          for (const component of food.components) {

            const selectedFood = this.getSelectedFood(component?.id ?? '');
            const servingId = this.getOriginalServingId(component?.id ?? '');
            const selectedServing = this.getSelectedServing(component?.id ?? '');  

            if ((selectedFood as any)?.providerFoodId && servingId && selectedServing) {
              const displayQuantity = this.getEffectiveQuantity(component?.id ?? '', selectedServing);
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
    
  
    this.isSubmitting = true;
    this.editConfirmed.emit(req);
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
   * Get the displayed quantity using the new formula: baseQuantity × aiRecommendedScale
   */
  private getDisplayedQuantity(s: ComponentServing | null): number {
    if (!s) return 1;

    const baseQuantity = s.baseQuantity || 1;
    const aiScale = s.aiRecommendedScale || 1;
    return baseQuantity * aiScale;
  }

  // Compute all foods as FoodDisplay objects with embedded state
  private computeAllFoods(): void {
    const rawFoods = this.message?.logMealToolResponse?.foods || [];

    // Only rebuild from raw data - no state preservation needed
    this.computedFoods = rawFoods.map((food, foodIndex) => {
      const transformedComponents = food.components?.map((component: any) => {
        // Transform matches to include ComponentServingDisplay objects
        const transformedMatches = component.matches?.map((match: any) => {
          const transformedServings = match.servings?.map((serving: any) => {
            // Convert to ComponentServingDisplay with initial effectiveQuantity
            const effectiveQuantity = (serving.baseQuantity || 1) * (serving.aiRecommendedScale || 1);
            return new ComponentServingDisplay({
              ...serving,
              effectiveQuantity: effectiveQuantity,
              isSelected: false,
              unitText: serving.singularUnit || serving.baseUnit || '',
              servingLabel: `${effectiveQuantity} ${serving.singularUnit || serving.baseUnit || ''}`,
              userSelectedQuantity: effectiveQuantity,
              servingMultiplier: 1
            });
          }) || [];

          return new ComponentMatchDisplay({
            ...match,
            servings: transformedServings
          });
        }) || [];

        return new ComponentDisplay({
          ...component,
          matches: transformedMatches,
          // All UI state starts fresh
          isSearching: false,
          isEditing: false,
          isExpanded: false,
          editingValue: '',
          showingMoreOptions: false,
          loadingMoreOptions: false,
          loadingInstantOptions: false,
          moreOptions: [],
        });
      }) || [];


      return new FoodDisplay({
        ...food,
        components: transformedComponents,
        isEditingExpanded: false,
      });
    });

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
        c.id === componentId
          ? new ComponentDisplay({ ...c, ...changes })
          : c
      ) || []
    });
    this.onFoodChanged(foodIndex, newFood);
  }

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

  async removeComponent(foodIndex: number, componentId: string) {
    const food = this.computedFoods[foodIndex];
    if (!food?.components) return;

    // Check if last item
    if (food.components.length === 1) {
      this.removeFood(food.id ?? '');
      return;
    }

    const componentIndex = food.components.findIndex((c: ComponentDisplay) => c.id === componentId);
    if (componentIndex === -1) return;

    // Capture original components BEFORE removal (for undo)
    const componentsToRestore = [...food.components];

    // Get component for display name
    const componentToRemove = food.components[componentIndex];

    // Create NEW components array (without the removed item)
    const newComponents = [
      ...food.components.slice(0, componentIndex),
      ...food.components.slice(componentIndex + 1)
    ];

    // Create NEW food with updated components
    const updatedFood = new FoodDisplay({
      ...food,
      components: newComponents
    });

    // Update the array
    this.computedFoods[foodIndex] = updatedFood;
    this.computedFoods = [...this.computedFoods];

    setTimeout(async () => {
      // Get display name from component's selected match
      const selectedMatch = componentToRemove?.matches?.find((m: any) => m.isBestMatch)
                           || componentToRemove?.matches?.[0];
      const itemName = selectedMatch?.displayName || 'item';
      
      await this.toastService.showToast({
        message: `${itemName} removed`,
        duration: 3000,
        color: 'medium',
        buttons: [
          {
            text: 'Undo',
            handler: () => {
              // Use map to create completely new array - this triggers OnPush change detection
              this.computedFoods = this.computedFoods.map(f =>
                f.id === food.id
                  ? new FoodDisplay({ ...f, components: componentsToRestore })
                  : f
              );
              this.cdr.detectChanges();
            }
          }
        ]
      });
    }, 300);
  }

  async removeFood(foodId: string) {
    const foodIndex = this.computedFoods.findIndex(f => f.id === foodId);
    if (foodIndex === -1) return;

    // Check if last food
    if (this.computedFoods.length === 1) {
      this.cancelSelection();
      return;
    }

    // Capture original foods array BEFORE removal (for undo)
    const foodsToRestore = [...this.computedFoods];

    // Get food for display name
    const foodToRemove = this.computedFoods[foodIndex];

    // Create NEW foods array (without the removed item)
    const newFoods = [
      ...this.computedFoods.slice(0, foodIndex),
      ...this.computedFoods.slice(foodIndex + 1)
    ];

    // Update the array
    this.computedFoods = newFoods;

    // Get food name for toast
    const foodName = foodToRemove.name || 'food item';

    // Show toast with undo
    await this.toastService.showToast({
      message: `${foodName} removed`,
      duration: 3000,
      color: 'medium',
      buttons: [{
        text: 'Undo',
        handler: () => {
          // Simply restore the original foods array
          this.computedFoods = foodsToRestore;
          this.cdr.detectChanges();
        }
      }]
    });
  }

  async cancelSelection(): Promise<void> {
    // Start the canceling state to show thinking dots
    this.isCanceling = true;
    
    // Show toast with undo option
    const toast = await this.toastService.showToast({
      message: 'Food logging canceled',
      duration: 3000,
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
    }, 3000);
    
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

  async editFoodPhraseOnComponent(foodIndex: number, componentId: string, newPhrase: string): Promise<void> {
    if (!newPhrase || !newPhrase.trim()) {
      return;
    }

    var food = this.computedFoods[foodIndex];
    var componentToUpdate = food.components?.find(c => c.id === componentId);
    

    const request = new SearchFoodPhraseRequest({
      originalPhrase: 'UPDATE',
      searchPhrase: newPhrase.trim(),
      messageId: this.message.id || '',
      componentId: componentId,
      localDateKey: this.dateService.getSelectedDate()
    });

    const response = await this.foodSelectionService.updateFoodPhrase(request).toPromise();

    if (response?.isSuccess && response.foodOptions && response.foodOptions.length > 0) {
      // Get the updated food from response  
      const updatedFood = new FoodDisplay(response.foodOptions[0]);

      // Preserve UI state from old components
      const oldFood = this.computedFoods[foodIndex];
      oldFood.components?.forEach((oldComp, idx) => {
        if (updatedFood.components?.[idx]) {
          // Preserve expanded state and other UI properties
          updatedFood.components[idx].isExpanded = oldComp.isExpanded;
          updatedFood.components[idx].showingMoreOptions = oldComp.showingMoreOptions;
        }
      });

      // Replace the food
      this.computedFoods[foodIndex] = updatedFood;
      this.computedFoods = [...this.computedFoods];
      this.cdr.detectChanges();
    } else {
      // Reset searching state on error
      this.onComponentChanged(foodIndex, componentId, {
        isSearching: false
      });
      await this.showErrorToast('Failed to update food. Please try again.');
    }
  }
  
  async onFoodAdded(phrase: string): Promise<void> {
    this.isAddingFood = false;

      // Handle the new food phrase submission directly
      const request = new SearchFoodPhraseRequest({
        searchPhrase: phrase,
        originalPhrase: '',
        messageId: this.message.id || '',
        localDateKey: this.dateService.getSelectedDate()
      });

      var component = new ComponentDisplay({
        isSearching: true,
        isEditing: false,
        isExpanded: false,
        editingValue: '',
        showingMoreOptions: false,
        isNewAddition: true,
      });

      var tempLoadingFoodId = 'temp-loading-' + Date.now();

      var tempLoadingFood = new FoodDisplay({
        id: tempLoadingFoodId,
        name: '',
        components: [component]
      });

      this.computedFoods = [...this.computedFoods, tempLoadingFood];

      const response = await this.foodSelectionService.searchFoodPhrase(request).toPromise();
      var tempFoodToReplaceIndex = this.computedFoods.findIndex(x => x.id === tempLoadingFoodId);
      if (response?.isSuccess) {
        var newFoods = response.foodOptions?.map(x => new FoodDisplay(x) );
        
        this.computedFoods = [...this.computedFoods.slice(0, tempFoodToReplaceIndex), ...newFoods || [], ...this.computedFoods.slice(tempFoodToReplaceIndex + 1)];
        this.cdr.detectChanges();
      } else {
        this.computedFoods = [...this.computedFoods.slice(0, tempFoodToReplaceIndex), ...this.computedFoods.slice(tempFoodToReplaceIndex + 1)];
        this.cdr.detectChanges();
        await this.showErrorToast('Failed to add food. Please try again.');
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

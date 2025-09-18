import { Injectable } from '@angular/core';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { NutritionAmbitionApiService, SubmitServingSelectionRequest, CancelServingSelectionRequest, ChatMessagesResponse, ErrorDto, EditFoodSelectionRequest, SubmitEditServingSelectionRequest, CancelEditSelectionRequest, SearchFoodPhraseRequest, SearchFoodPhraseResponse, HydrateFoodSelectionRequest, HydrateFoodSelectionResponse, GetInstantAlternativesRequest, GetInstantAlternativesResponse, ComponentServing } from '../services/nutrition-ambition-api.service';
import { DateService } from './date.service';
import { ComponentServingDisplay } from '../models/food-selection-display';

@Injectable({
  providedIn: 'root'
})
export class FoodSelectionService {
  // State management for food selection
  private selectedServings: Map<string, string> = new Map(); // componentId -> servingId
  private servingQuantities: Map<string, number> = new Map(); // componentId:servingId -> quantity
  private expandedComponents: Set<string> = new Set(); // componentId
  private expandedFoods: Set<number> = new Set(); // foodIndex

  // Observable state changes
  private servingSelectionChange$ = new BehaviorSubject<{componentId: string, servingId: string} | null>(null);
  private quantityChange$ = new BehaviorSubject<{componentId: string, servingId: string, quantity: number} | null>(null);
  private expansionChange$ = new BehaviorSubject<{componentId: string, expanded: boolean} | null>(null);

  // Public observables
  servingSelectionChanges$ = this.servingSelectionChange$.asObservable();
  quantityChanges$ = this.quantityChange$.asObservable();
  expansionChanges$ = this.expansionChange$.asObservable();

  constructor(
    private apiService: NutritionAmbitionApiService,
    private dateService: DateService
  ) {}

  submitServingSelection(request: SubmitServingSelectionRequest): Observable<ChatMessagesResponse> {
    // Ensure localDateKey is set
    request.localDateKey = this.dateService.getSelectedDate();

    return this.apiService.submitServingSelection(request).pipe(
      catchError(err => {
        const errorDto = new ErrorDto();
        errorDto.errorMessage = 'Submission failed';
        return of(new ChatMessagesResponse({ isSuccess: false, errors: [errorDto] }));
      })
    );
  }

  cancelFoodLogging(request: CancelServingSelectionRequest): Observable<ChatMessagesResponse> {
    // Ensure localDateKey is set
    request.localDateKey = this.dateService.getSelectedDate();

    return this.apiService.cancelFoodLogging(request).pipe(
      catchError(err => {
        const errorDto = new ErrorDto();
        errorDto.errorMessage = 'Cancel failed';
        return of(new ChatMessagesResponse({ isSuccess: false, errors: [errorDto] }));
      })
    );
  }

  startEditFoodSelection(req: EditFoodSelectionRequest): Observable<ChatMessagesResponse> {
    if (!req.localDateKey) req.localDateKey = this.dateService.getSelectedDate();
    return this.apiService.startEditSelection(req).pipe(
      catchError(err => {
        const error = new ErrorDto({ errorMessage: 'Start edit failed' });
        return of(new ChatMessagesResponse({ isSuccess: false, errors: [error] }));
      })
    );
  }

  submitEditServingSelection(request: SubmitEditServingSelectionRequest): Observable<ChatMessagesResponse> {
    // Ensure localDateKey is set
    request.localDateKey = this.dateService.getSelectedDate();

    return this.apiService.submitEditServingSelection(request).pipe(
      catchError(err => {
        const errorDto = new ErrorDto();
        errorDto.errorMessage = 'Edit submission failed';
        return of(new ChatMessagesResponse({ isSuccess: false, errors: [errorDto] }));
      })
    );
  }

  cancelEditSelection(request: CancelEditSelectionRequest): Observable<ChatMessagesResponse> {
    // Ensure localDateKey is set
    request.localDateKey = this.dateService.getSelectedDate();

    return this.apiService.cancelEditSelection(request).pipe(
      catchError(err => {
        const errorDto = new ErrorDto();
        errorDto.errorMessage = 'Cancel edit failed';
        return of(new ChatMessagesResponse({ isSuccess: false, errors: [errorDto] }));
      })
    );
  }

  searchFoodPhrase(request: SearchFoodPhraseRequest): Observable<SearchFoodPhraseResponse> {
    // Ensure localDateKey is set
    request.localDateKey = request.localDateKey || this.dateService.getSelectedDate();

    var response = this.apiService.searchFoodPhrase(request).pipe(
      catchError(err => {
        const errorDto = new ErrorDto();
        errorDto.errorMessage = 'Search failed';
        return of(new SearchFoodPhraseResponse({ isSuccess: false, errors: [errorDto] }));
      })
    );

    return response;
  }

  updateFoodPhrase(request: SearchFoodPhraseRequest): Observable<SearchFoodPhraseResponse> {
    // Ensure localDateKey is set
    request.localDateKey = request.localDateKey || this.dateService.getSelectedDate();

    var response = this.apiService.updateFoodPhrase(request).pipe(
      catchError(err => {
        const errorDto = new ErrorDto();
        errorDto.errorMessage = 'Update failed';
        return of(new SearchFoodPhraseResponse({ isSuccess: false, errors: [errorDto] }));
      })
    );

    return response;
  }

  hydrateFoodSelection(request: HydrateFoodSelectionRequest): Observable<HydrateFoodSelectionResponse> {
    return this.apiService.hydrateFoodSelection(request).pipe(
      catchError(err => {
        const errorDto = new ErrorDto();
        errorDto.errorMessage = 'Hydration failed';
        return of(new HydrateFoodSelectionResponse({ isSuccess: false, errors: [errorDto] }));
      })
    );
  }

  getInstantAlternatives(request: GetInstantAlternativesRequest): Observable<GetInstantAlternativesResponse> {
    // Ensure localDateKey is set
    request.localDateKey = request.localDateKey || this.dateService.getSelectedDate();

    return this.apiService.getInstantAlternatives(request).pipe(
      catchError(err => {
        const errorDto = new ErrorDto();
        errorDto.errorMessage = 'Failed to get instant alternatives';
        return of(new GetInstantAlternativesResponse({ isSuccess: false, errors: [errorDto] }));
      })
    );
  }

  // State management methods
  selectServing(componentId: string, servingId: string): void {
    this.selectedServings.set(componentId, servingId);
    this.servingSelectionChange$.next({componentId, servingId});
  }

  getSelectedServing(componentId: string): string | undefined {
    return this.selectedServings.get(componentId);
  }

  updateServingQuantity(componentId: string, servingId: string, quantity: number): void {
    const key = `${componentId}:${servingId}`;
    this.servingQuantities.set(key, quantity);
    this.quantityChange$.next({componentId, servingId, quantity});
  }

  // NEW: Update serving quantity using unit-to-serving conversion
  updateServingQuantityFromUnits(componentId: string, servingId: string, userSelectedUnits: number, baseQuantityPerServing: number): void {
    const servingMultiplier = userSelectedUnits / baseQuantityPerServing;
    this.updateServingQuantity(componentId, servingId, servingMultiplier);
  }

  getServingQuantity(componentId: string, servingId: string): number {
    const key = `${componentId}:${servingId}`;
    return this.servingQuantities.get(key) || 1;
  }

  toggleComponentExpansion(componentId: string): void {
    const wasExpanded = this.expandedComponents.has(componentId);
    if (wasExpanded) {
      this.expandedComponents.delete(componentId);
    } else {
      this.expandedComponents.add(componentId);
    }
    this.expansionChange$.next({componentId, expanded: !wasExpanded});
  }

  isComponentExpanded(componentId: string): boolean {
    return this.expandedComponents.has(componentId);
  }

  toggleFoodExpansion(foodIndex: number): void {
    const wasExpanded = this.expandedFoods.has(foodIndex);
    if (wasExpanded) {
      this.expandedFoods.delete(foodIndex);
    } else {
      this.expandedFoods.add(foodIndex);
    }
  }

  isFoodExpanded(foodIndex: number): boolean {
    return this.expandedFoods.has(foodIndex);
  }

  // Clear state when starting a new selection
  clearState(): void {
    this.selectedServings.clear();
    this.servingQuantities.clear();
    this.expandedComponents.clear();
    this.expandedFoods.clear();
  }

  // Helper method to enhance servings with display properties
  enhanceServingsWithDisplayProps(servings: ComponentServing[], componentId: string, isSingleComponentFood: boolean = false, parentQuantity: number = 1): ComponentServingDisplay[] {
    let selectedServingId = this.getSelectedServing(componentId);

    // If no serving is selected yet, auto-select the first one
    if (!selectedServingId && servings.length > 0) {
      selectedServingId = servings[0].id || '';
      if (selectedServingId) {
        this.selectServing(componentId, selectedServingId);
      }
    }

    return servings.map(serving => {
      const display = new ComponentServingDisplay(serving);
      const servingId = serving.id || '';

      // Set display properties
      display.isSelected = servingId === selectedServingId;

      // Initialize serving multiplier fields from backend
      display.baseQuantity = serving.baseQuantity || 1;  // Original units per serving from backend
      display.baseUnit = serving.baseUnit || '';

      // Get AI-recommended scale from backend (this replaces the old scaledQuantity approach)
      const aiRecommendedScale = serving.aiRecommendedScale || 1.0;

      // Calculate the AI-recommended display quantity: baseQuantity × aiRecommendedScale
      const aiRecommendedQuantity = display.baseQuantity * aiRecommendedScale;

      // Get current user selection or default to AI recommendation
      const currentServingMultiplier = this.getServingQuantity(componentId, servingId);
      if (currentServingMultiplier) {
        // User has made a selection - use their choice
        display.userSelectedQuantity = currentServingMultiplier * display.baseQuantity;
        display.servingMultiplier = currentServingMultiplier;
      } else {
        // Default: use AI-recommended quantity (e.g., 2 slices for bread, 2 tbsp for PB)
        display.userSelectedQuantity = aiRecommendedQuantity;
        display.servingMultiplier = aiRecommendedScale;
        // Auto-select this serving with AI recommended scale factor
        this.updateServingQuantity(componentId, servingId, aiRecommendedScale);
      }

      // Calculate effective quantity for display
      display.effectiveQuantity = isSingleComponentFood && parentQuantity > 1
        ? display.userSelectedQuantity * parentQuantity
        : display.userSelectedQuantity;

      // Set unit text using singular/plural forms for proper grammar
      const effectiveQuantity = display.userSelectedQuantity || 1;
      if (effectiveQuantity === 1 && serving.singularUnit) {
        display.unitText = serving.singularUnit;
      } else if (serving.pluralUnit) {
        display.unitText = serving.pluralUnit;
      } else {
        // Fallback to baseUnit
        display.unitText = display.baseUnit;
      }
      display.servingLabel = `${display.effectiveQuantity} ${display.unitText}`;

      return display;
    });
  }
}
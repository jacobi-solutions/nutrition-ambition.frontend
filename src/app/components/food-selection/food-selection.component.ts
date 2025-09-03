import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonButton, IonRadioGroup, IonRadio, IonSelect, IonSelectOption, IonIcon, IonGrid, IonRow, IonCol } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { createOutline, chevronUpOutline, trashOutline, send, addCircleOutline } from 'ionicons/icons';
import { ComponentMatch, ComponentServing, SubmitServingSelectionRequest, UserSelectedServing, SubmitEditServingSelectionRequest, MessageRoleTypes, NutritionAmbitionApiService, SearchFoodPhraseRequest } from 'src/app/services/nutrition-ambition-api.service';
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
  @Output() phraseEditRequested = new EventEmitter<{originalPhrase: string, newPhrase: string, messageId: string}>();

  isReadOnly = false;
  isEditMode = false;

  selections: { [phrase: string]: { foodId: string; servingId?: string } } = {};
  expandedSections: { [phrase: string]: boolean } = {};
  removedPhrases: Set<string> = new Set();
  isSubmitting = false;
  isCanceling = false;
  private cancelTimeout: any = null;
  editingPhrases: { [phrase: string]: boolean } = {};
  editingPhraseValues: { [phrase: string]: string } = {};
  searchingPhrases: { [phrase: string]: boolean } = {};
  
  // Add something functionality
  isAddingFood = false;
  newFoodPhrase = '';
  isSubmittingNewFood = false;

  constructor(
    private toastService: ToastService, 
    private cdr: ChangeDetectorRef,
    private apiService: NutritionAmbitionApiService,
    private dateService: DateService
  ) {
    addIcons({ createOutline, chevronUpOutline, trashOutline, send, addCircleOutline });
  }

  get hasPayload(): boolean {
    return !!this.message.foodOptions && Object.keys(this.message.foodOptions).length > 0;
  }

  get payloadKeys(): string[] {
    if (!this.message.foodOptions) return [];
    return Object.keys(this.message.foodOptions).filter(p => !this.removedPhrases.has(p));
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
    if (!this.message.foodOptions) return;
    for (const phrase of Object.keys(this.message.foodOptions)) {
      const foods = this.message.foodOptions[phrase];
      const foodId = foods?.[0]?.fatSecretFoodId;
      // Ensure we preserve the selectedServingId from the API
      const servingId = foods?.[0]?.selectedServingId;
      if (foodId) {
        this.selections[phrase] = { foodId, servingId };
      }
      this.expandedSections[phrase] = false;
    }
    this.isReadOnly = this.message.role === MessageRoleTypes.CompletedFoodSelection || this.message.role === MessageRoleTypes.CompletedEditFoodSelection;
    this.isEditMode = this.message.role === MessageRoleTypes.PendingEditFoodSelection;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isReadOnly'] && this.isReadOnly) this.isSubmitting = false;
  }

  toggleExpansion(phrase: string): void {
    this.expandedSections[phrase] = !this.expandedSections[phrase];
  }

  isExpanded(phrase: string): boolean {
    return !!this.expandedSections[phrase];
  }

  getSelectedFood(phrase: string): ComponentMatch | null {
    const selection = this.selections[phrase];
    return this.message.foodOptions?.[phrase]?.find(f => f.fatSecretFoodId === selection?.foodId) || null;
  }

  onFoodSelected(phrase: string, foodId: string): void {
    const food = this.message.foodOptions?.[phrase]?.find(f => f.fatSecretFoodId === foodId);
    const defaultServingId = food?.servings?.[0]?.fatSecretServingId;
    this.selections[phrase] = { foodId, servingId: defaultServingId };
  }

  onServingSelected(phrase: string, servingId: string): void {
    if (this.selections[phrase]) this.selections[phrase].servingId = servingId;
  }

  getSelectedServingId(phrase: string): string | undefined {
    return this.selections[phrase]?.servingId;
  }

  getSelectedServing(phrase: string): ComponentServing | null {
    const food = this.getSelectedFood(phrase);
    const id = this.getSelectedServingId(phrase);
    return food?.servings?.find(s => s.fatSecretServingId === id) || null;
  }

  // Getter to always derive the selected serving for a food match
  getSelectedServingForFood(match: ComponentMatch): ComponentServing | undefined {
    return match?.servings?.find(s => s.fatSecretServingId === match.selectedServingId);
  }

  // TrackBy function to prevent DOM reuse issues
  trackByServingId(index: number, serving: ComponentServing): string {
    return serving.fatSecretServingId || `${index}`;
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
    if (!this.message.foodOptions) return false;
    return this.payloadKeys.every(phrase => {
      const sel = this.selections[phrase];
      return sel?.foodId && sel?.servingId;
    });
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

    for (const phrase of this.payloadKeys) {
      const food = this.getSelectedFood(phrase);
      const servingId = this.getSelectedServingId(phrase);
      const selectedServing = this.getSelectedServing(phrase);
      
      if (food?.fatSecretFoodId && servingId && selectedServing) {
        // Get the effective quantity (prefer effectiveQuantity if available)
        const displayQuantity = this.getEffectiveQuantity(phrase, selectedServing);
        
        req.selections.push(new UserSelectedServing({
          originalText: phrase,
          fatSecretFoodId: food.fatSecretFoodId,
          fatSecretServingId: servingId,
          editedQuantity: displayQuantity
        }));
      }
    }

    this.isSubmitting = true;
    this.selectionConfirmed.emit(req);
  }

  private confirmEditSelections(): void {
    const req = new SubmitEditServingSelectionRequest();
    req.pendingMessageId = this.message.id;
    req.foodEntryId = this.message.logMealToolResponse?.foodEntryId ?? '';
    req.groupId = this.message.logMealToolResponse?.groupId ?? '';
    req.itemSetId = this.message.logMealToolResponse?.itemSetId ?? '';
    req.selections = [];
  
    for (const phrase of this.payloadKeys) {
      const food = this.getSelectedFood(phrase);
      const servingId = this.getSelectedServingId(phrase);
      const selectedServing = this.getSelectedServing(phrase);
  
      if (food?.fatSecretFoodId && servingId && selectedServing) {
        const displayQuantity = this.getEffectiveQuantity(phrase, selectedServing);
        req.selections.push(new UserSelectedServing({
          originalText: phrase,
          fatSecretFoodId: food.fatSecretFoodId,
          fatSecretServingId: servingId,
          editedQuantity: displayQuantity
        }));
      }
    }
  
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

  getEffectiveQuantity(phrase: string, serving: ComponentServing | null): number {
    // Always prioritize the serving's displayQuantity for UI display
    // This ensures the stepper shows the correct UI value (e.g., 0.42 cup instead of 100)
    if (serving && serving.displayQuantity !== undefined && isFinite(serving.displayQuantity) && serving.displayQuantity > 0) {
      return serving.displayQuantity;
    }
    
    // Fall back to food's effectiveQuantity only if serving's displayQuantity is not available
    const food = this.getSelectedFood(phrase);
    if (food && (food as any).effectiveQuantity && (food as any).effectiveQuantity > 0) {
      return (food as any).effectiveQuantity;
    }
    
    return this.getDisplayQuantity(serving);
  }

  getDisplayNameOrSearchText(phrase: string): string {
    const food = this.getSelectedFood(phrase);
    if (food && (food as any).inferred && (food as any).searchText) {
      return (food as any).searchText;
    }
    return food?.displayName || '';
  }

  isInferred(phrase: string): boolean {
    const food = this.getSelectedFood(phrase);
    return !!(food && (food as any).inferred === true);
  }

  getSearchTextOnly(phrase: string): string {
    const food = this.getSelectedFood(phrase);
    if (food && (food as any).inferred && (food as any).searchText) {
      return (food as any).searchText;
    }
    return phrase;
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


  async removeItem(phrase: string) {
    const rowElement = document.getElementById(`row-${phrase}`);
    if (rowElement) rowElement.classList.add('removing');

    setTimeout(async () => {
      this.removedPhrases.add(phrase);

      // Check if this was the last remaining food item
      const remainingItems = this.payloadKeys; // This will exclude the just-removed item
      const isLastItem = remainingItems.length === 0;

      if (isLastItem) {
        // If this was the last item, trigger cancellation instead of showing undo toast
        this.cancelSelection();
        return;
      }

      await this.toastService.showToast({
        message: `${this.getSelectedFood(phrase)?.displayName || phrase} removed`,
        duration: 5000,
        color: 'medium',
        buttons: [
          {
            text: 'Undo',
            handler: () => {
              this.removedPhrases.delete(phrase);
            }
          }
        ]
      });
    }, 300);
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

  private rescaleFromSelected(phrase: string, selected: ComponentServing, editedQty: number): void {
    // 0) guard
    if (!this.message.foodOptions?.[phrase]) return;
    
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
    const selectedFood = this.getSelectedFood(phrase);
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
      (s as any).isBestMatch = s.fatSecretServingId === editedId;
    }

    // ensure UI shows the edited row as selected
    if (editedId) {
      this.onServingSelected(phrase, editedId);
    }
  }

  onInlineQtyChanged(phrase: string, s: ComponentServing, newValue: number): void {
    // clamp
    const v = Math.max(0.1, Math.min(999, Number(newValue) || 0));
    (s as any).displayQuantity = v;

    // if this row isn't selected, select it now
    const currentSelected = this.getSelectedServingId(phrase);
    if (currentSelected !== s.fatSecretServingId && s.fatSecretServingId) {
      this.onServingSelected(phrase, s.fatSecretServingId);
    }

    // For simple cases like "medium banana", just update scaledQuantity directly
    // This is a simpler approach that works for household servings
    (s as any).scaledQuantity = v;
    
    // Also update display values for this serving
    const units = this.getNumberOfUnits(s);
    (s as any).displayQuantity = v;
    (s as any).displayUnit = this.getUnitText(s);
    
    // Mark this as the best match
    const selectedFood = this.getSelectedFood(phrase);
    if (selectedFood?.servings) {
      for (const serving of selectedFood.servings) {
        (serving as any).isBestMatch = serving.fatSecretServingId === s.fatSecretServingId;
      }
    }

    // drive the rescale from the selected row and edited quantity (for other servings)
    this.rescaleFromSelected(phrase, s, v);
    
    // Force change detection to update the UI immediately
    this.cdr.detectChanges();
  }

  onRowClicked(phrase: string, s: ComponentServing): void {
    const current = this.getSelectedServingId(phrase);
    if (current !== s.fatSecretServingId && s.fatSecretServingId) {
      this.onServingSelected(phrase, s.fatSecretServingId);
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
      this.isCanceling = false;
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
        this.isCanceling = false;
      }
    });
  }

  async onEditPhrase(phrase: string): Promise<void> {
    const food = this.getSelectedFood(phrase);
    if (!food) return;

    const missingInfo = this.getMissingInformation(food);
    const suggestionMessage = this.generateSuggestionMessage(phrase, missingInfo);
    
    // Show suggestion as a positioned tooltip above the phrase input
    this.showSuggestionTooltip(phrase, suggestionMessage);
  }

  private showSuggestionTooltip(phrase: string, message: string): void {
    // Remove any existing tooltip
    this.removeSuggestionTooltip();
    
    // Find the specific phrase container using the data attribute
    const phraseContainer = document.querySelector(`[data-phrase="${phrase}"]`) as HTMLElement;
    if (!phraseContainer) {
      console.log('Could not find phrase container for:', phrase);
      return;
    }
    
    // Look for textarea first (edit mode), then phrase text (display mode)
    let targetElement = phraseContainer.querySelector('textarea.phrase-input') as HTMLElement;
    if (!targetElement) {
      targetElement = phraseContainer.querySelector('.phrase-text') as HTMLElement;
    }
    
    if (!targetElement) {
      console.log('Could not find target element in container for:', phrase);
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

  isPhraseBeingEdited(phrase: string): boolean {
    return !!this.editingPhrases[phrase];
  }

  isSearchingPhrase(phrase: string): boolean {
    // Check if this phrase has a ComponentMatch with isEditingPhrase = true
    const foods = this.message.foodOptions?.[phrase];
    if (foods && foods.length > 0 && (foods[0] as any).isEditingPhrase) {
      return true;
    }
    return !!this.searchingPhrases[phrase];
  }

  clearPhraseSearching(phrase: string): void {
    this.searchingPhrases[phrase] = false;
    delete this.searchingPhrases[phrase];
  }



  onTextareaBlur(phrase: string, event: FocusEvent): void {
    // Check if the focus is moving to the send button
    const relatedTarget = event.relatedTarget as HTMLElement;
    if (relatedTarget && relatedTarget.classList.contains('send-button')) {
      return; // Don't close edit mode
    }
    
    // Use a small delay to allow button click to process first
    setTimeout(() => {
      this.finishEditingPhrase(phrase);
    }, 150);
  }

  async startEditingPhrase(phrase: string): Promise<void> {
    // First enable editing mode
    this.editingPhrases[phrase] = true;
    this.editingPhraseValues[phrase] = this.getSearchTextOnly(phrase);
    this.cdr.detectChanges();
    
    // Then show the suggestion toast and focus the textarea
    setTimeout(async () => {
      // Show the suggestion toast
      await this.onEditPhrase(phrase);
      
      // Focus the textarea and ensure proper sizing
      const textarea = document.querySelector(`textarea.phrase-input`) as HTMLTextAreaElement;
      if (textarea) {
        textarea.focus();
        this.autoResizeTextarea(textarea);
      }
    }, 0);
  }

  getEditingPhraseValue(phrase: string): string {
    return this.editingPhraseValues[phrase] || phrase;
  }



  updateEditingPhrase(phrase: string, event: any): void {
    this.editingPhraseValues[phrase] = event.target.value;
    this.autoResizeTextarea(event.target);
  }

  onPhraseKeyDown(phrase: string, event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      // Enter without shift sends the message
      event.preventDefault();
      this.sendUpdatedPhrase(phrase);
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

  hasChanges(phrase: string): boolean {
    const currentValue = this.editingPhraseValues[phrase];
    return !!(currentValue && currentValue.trim() !== phrase.trim());
  }

  sendUpdatedPhrase(phrase: string): void {
    const newValue = this.editingPhraseValues[phrase];
    
    if (!newValue || newValue.trim() === phrase) {
      console.log('No changes detected, not sending');
      return;
    }

    console.log(`Requesting phrase edit: "${phrase}" → "${newValue}"`);
    
    // Set loading state for this specific phrase
    this.searchingPhrases[phrase] = true;
    
    // Emit the phrase edit request to the parent (chat page)
    this.phraseEditRequested.emit({
      originalPhrase: phrase,
      newPhrase: newValue.trim(),
      messageId: this.message.id || ''
    });
    
    // Clear the editing state since we're now in loading state
    this.finishEditingPhrase(phrase);
  }

  finishEditingPhrase(phrase: string): void {
    const newValue = this.editingPhraseValues[phrase];
    if (newValue && newValue.trim() !== phrase) {
      // Here you could emit an event to update the phrase or trigger a new search
      console.log(`Phrase changed from "${phrase}" to "${newValue}"`);
    }
    
    // Make the input readonly again
    const inputElement = document.querySelector(`input[value="${newValue || phrase}"]`) as HTMLInputElement;
    if (inputElement) {
      inputElement.setAttribute('readonly', 'true');
    }
    
    this.editingPhrases[phrase] = false;
    delete this.editingPhraseValues[phrase];
  }

  cancelEditingPhrase(phrase: string): void {
    this.editingPhrases[phrase] = false;
    delete this.editingPhraseValues[phrase];
  }

  private updateFoodOptionsInPlace(originalPhrase: string, newPhrase: string, newFoodOptions: { [phrase: string]: ComponentMatch[] }, mealName?: string): void {
    if (!this.message.foodOptions) {
      return;
    }

    // Remove the old phrase entry
    delete this.message.foodOptions[originalPhrase];
    
    // Add the new phrase entry with the new food options
    Object.keys(newFoodOptions).forEach(phrase => {
      this.message.foodOptions![phrase] = newFoodOptions[phrase];
    });

    // Don't update the meal name - keep the original title
    // if (mealName) {
    //   this.message.mealName = mealName;
    // }

    // Clear the editing state for the original phrase
    delete this.editingPhrases[originalPhrase];
    delete this.editingPhraseValues[originalPhrase];

    // Update selections to point to the new phrase if it exists
    if (this.selections[originalPhrase]) {
      const oldSelection = this.selections[originalPhrase];
      delete this.selections[originalPhrase];
      
      // Find the new phrase key and set up selection for it
      const newPhraseKey = Object.keys(newFoodOptions)[0];
      if (newPhraseKey && newFoodOptions[newPhraseKey] && newFoodOptions[newPhraseKey].length > 0) {
        const firstFood = newFoodOptions[newPhraseKey][0];
        this.selections[newPhraseKey] = {
          foodId: firstFood.fatSecretFoodId || '',
          servingId: firstFood.servings?.[0]?.fatSecretServingId
        };
      }
    }

    // Force change detection
    this.cdr.detectChanges();
    
    console.log('Updated food options in place:', newFoodOptions);
  }

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
      messageId: this.message.id || ''
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

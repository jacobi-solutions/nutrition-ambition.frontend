import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonButton, IonRadioGroup, IonRadio, IonSelect, IonSelectOption, IonIcon, IonGrid, IonRow, IonCol, ToastController } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { createOutline, chevronUpOutline, trashOutline } from 'ionicons/icons';
import { SelectableFoodMatch, SelectableFoodServing, SubmitServingSelectionRequest, UserSelectedServing, SubmitEditServingSelectionRequest } from 'src/app/services/nutrition-ambition-api.service';
import { ServingQuantityInputComponent } from 'src/app/components/serving-quantity-input/serving-quantity-input.component';

@Component({
  selector: 'app-food-selection',
  templateUrl: './food-selection.component.html',
  styleUrls: ['./food-selection.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonButton, IonRadioGroup, IonRadio, IonSelect, IonSelectOption, IonIcon, IonGrid, IonRow, IonCol, ServingQuantityInputComponent]
})
export class FoodSelectionComponent implements OnInit, OnChanges {
  @Input() foodOptions?: Record<string, SelectableFoodMatch[]> | null = null;
  @Input() mealName?: string | null = null;
  @Input() isReadOnly: boolean = false;
  @Input() isEditMode: boolean = false;
  @Input() messageId?: string;
  @Output() selectionConfirmed = new EventEmitter<SubmitServingSelectionRequest>();
  @Output() editConfirmed = new EventEmitter<SubmitEditServingSelectionRequest>();
  @Output() cancel = new EventEmitter<void>();

  selections: { [phrase: string]: { foodId: string; servingId?: string } } = {};
  expandedSections: { [phrase: string]: boolean } = {};
  removedPhrases: Set<string> = new Set();
  isSubmitting = false;
  isCanceling = false;
  private cancelTimeout: any = null;

  constructor(private toastController: ToastController, private cdr: ChangeDetectorRef) {
    addIcons({ createOutline, chevronUpOutline, trashOutline });
  }

  get hasPayload(): boolean {
    return !!this.foodOptions && Object.keys(this.foodOptions).length > 0;
  }

  get payloadKeys(): string[] {
    if (!this.foodOptions) return [];
    return Object.keys(this.foodOptions).filter(p => !this.removedPhrases.has(p));
  }

  ngOnInit(): void {
    if (!this.foodOptions) return;
    for (const phrase of Object.keys(this.foodOptions)) {
      const foods = this.foodOptions[phrase];
      const foodId = foods?.[0]?.fatSecretFoodId;
      const servingId = foods?.[0]?.selectedServingId;
      if (foodId) this.selections[phrase] = { foodId, servingId };
      this.expandedSections[phrase] = false;
    }
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

  getSelectedFood(phrase: string): SelectableFoodMatch | null {
    const selection = this.selections[phrase];
    return this.foodOptions?.[phrase]?.find(f => f.fatSecretFoodId === selection?.foodId) || null;
  }

  onFoodSelected(phrase: string, foodId: string): void {
    const food = this.foodOptions?.[phrase]?.find(f => f.fatSecretFoodId === foodId);
    const defaultServingId = food?.servings?.[0]?.fatSecretServingId;
    this.selections[phrase] = { foodId, servingId: defaultServingId };
  }

  onServingSelected(phrase: string, servingId: string): void {
    if (this.selections[phrase]) this.selections[phrase].servingId = servingId;
  }

  getSelectedServingId(phrase: string): string | undefined {
    return this.selections[phrase]?.servingId;
  }

  getSelectedServing(phrase: string): SelectableFoodServing | null {
    const food = this.getSelectedFood(phrase);
    const id = this.getSelectedServingId(phrase);
    return food?.servings?.find(s => s.fatSecretServingId === id) || null;
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
  caloriesForServing(s: SelectableFoodServing | null) {
    return this.scaledMacro(s, ['Calories','calories','energy_kcal','Energy']);
  }
  proteinForServing(s: SelectableFoodServing | null) {
    return this.scaledMacro(s, ['Protein','protein']);
  }
  fatForServing(s: SelectableFoodServing | null) {
    return this.scaledMacro(s, ['Fat','fat','total_fat']);
  }
  carbsForServing(s: SelectableFoodServing | null) {
    return this.scaledMacro(s, ['Carbohydrate','carbohydrates','carbs']);
  }
  

  isSelectionComplete(): boolean {
    if (!this.foodOptions) return false;
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
    req.pendingMessageId = this.messageId;
    req.selections = [];

    for (const phrase of this.payloadKeys) {
      const food = this.getSelectedFood(phrase);
      const servingId = this.getSelectedServingId(phrase);
      const selectedServing = this.getSelectedServing(phrase);
      
      if (food?.fatSecretFoodId && servingId && selectedServing) {
        // Get the display quantity from the selected serving
        const displayQuantity = this.getDisplayQuantity(selectedServing);
        
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
    req.pendingMessageId = this.messageId;
    req.selections = [];

    for (const phrase of this.payloadKeys) {
      const food = this.getSelectedFood(phrase);
      const servingId = this.getSelectedServingId(phrase);
      const selectedServing = this.getSelectedServing(phrase);
      
      if (food?.fatSecretFoodId && servingId && selectedServing) {
        // Get the display quantity from the selected serving
        const displayQuantity = this.getDisplayQuantity(selectedServing);
        
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


  // Build the user-facing label for a serving row
  getServingLabel(s: SelectableFoodServing | null): string {
    if (!s) return '';
  
    const dq = (s as any).displayQuantity as number | undefined;
    const du = (s as any).displayUnit as string | undefined;
    if (dq !== undefined && du) return `${this.fmt(dq)} ${du}`.trim();
  
    const sq = (s as any).scaledQuantity as number | undefined;
    const su = (s as any).scaledUnit as string | undefined;
    if (sq !== undefined && su) return `${this.fmt(sq)} ${su}`;
  
    if (s.description) return s.description;
    return 'serving';
  }

  getDisplayQuantity(s: SelectableFoodServing | null): number {
    if (!s) return 1;
    
    const dq = (s as any).displayQuantity as number | undefined;
    if (dq !== undefined && isFinite(dq) && dq > 0) return dq;
    
    const sq = (s as any).scaledQuantity as number | undefined;
    if (sq !== undefined && isFinite(sq) && sq > 0) return sq;
    
    return 1;
  }

  getUnitText(s: SelectableFoodServing): string {
    const disp = (s as any).displayUnit as string | undefined;
    if (disp && disp.trim().length) return disp.trim();

    const desc = (s as any).description as string | undefined;
    const md = (s as any).measurementDescription as string | undefined;
    const mu = (s as any).metricServingUnit as string | undefined;

    // metric rows: use metric unit (g/ml)
    if (this.isMetricRow(s) && mu) return mu.trim();

    // household rows: strip leading numbers from description/measurementDescription
    const label = (desc && desc.trim().length ? desc : (md || '')).trim();
    const stripped = this.stripLeadingCount(label);
    return stripped || 'serving';
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
  private scaledMacro(s: SelectableFoodServing | null, keys: string[]): number | null {
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

      const toast = await this.toastController.create({
        message: `${this.getSelectedFood(phrase)?.displayName || phrase} removed`,
        duration: 5000,
        buttons: [
          {
            text: 'Undo',
            handler: () => {
              this.removedPhrases.delete(phrase);
            }
          }
        ]
      });
      await toast.present();
    }, 300);
  }

  // Rescaling helper methods
  private num(x: any): number {
    const n = parseFloat(x);
    return isFinite(n) ? n : NaN;
  }

  private getMetricAmt(s: SelectableFoodServing): number {
    return this.num((s as any).metricServingAmount);
  }

  private getMetricUnit(s: SelectableFoodServing): string {
    return String((s as any).metricServingUnit || '').trim();
  }

  private getNumberOfUnits(s: SelectableFoodServing): number {
    const units = this.num((s as any).numberOfUnits ?? 1);
    return isFinite(units) && units > 0 ? units : 1;
  }

  private stripLeadingCount(label: string | undefined): string {
    if (!label) return '';
    // Remove leading digits, fractions, and whitespace (e.g., "2 medium" -> "medium")
    return label.replace(/^\s*[\d¼½¾⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞.,/]*\s*/, '').trim();
  }

  private isMetricRow(s: SelectableFoodServing): boolean {
    const desc = (s as any).description as string | undefined;
    const mu = this.getMetricUnit(s).toLowerCase();
    const md = (s as any).measurementDescription as string | undefined;
    
    // Consider "100 g", "250 ml", or measurementDescription==="g"/"ml" as metric rows
    const looksMetric = !!desc && /^\s*[\d¼½¾⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]/.test(desc) && ['g','ml','l'].includes(mu);
    const mdMetric = (md || '').trim().toLowerCase();
    return looksMetric || mdMetric === 'g' || mdMetric === 'ml';
  }

  private rescaleFromSelected(phrase: string, selected: SelectableFoodServing, editedQty: number): void {
    // 0) guard
    if (!this.foodOptions?.[phrase]) return;
    
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

  onInlineQtyChanged(phrase: string, s: SelectableFoodServing, newValue: number): void {
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

  onRowClicked(phrase: string, s: SelectableFoodServing): void {
    const current = this.getSelectedServingId(phrase);
    if (current !== s.fatSecretServingId && s.fatSecretServingId) {
      this.onServingSelected(phrase, s.fatSecretServingId);
    }
  }

  async cancelSelection(): Promise<void> {
    // Start the canceling state to show thinking dots
    this.isCanceling = true;
    
    // Show toast with undo option
    const toast = await this.toastController.create({
      message: 'Food logging canceled',
      duration: 5000,
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
    
    await toast.present();
    
    // Set a timeout to actually cancel after toast duration
    this.cancelTimeout = setTimeout(() => {
      // Toast expired without undo - proceed with cancellation
      this.cancel.emit();
      this.cancelTimeout = null;
    }, 5000);
    
    // Listen for toast dismissal (if user dismisses manually)
    toast.onDidDismiss().then((result) => {
      // If toast was dismissed but not by undo button, proceed with cancellation
      if (result.role !== 'cancel' && this.isCanceling && this.cancelTimeout) {
        // User dismissed toast manually - proceed with cancellation immediately
        clearTimeout(this.cancelTimeout);
        this.cancel.emit();
        this.cancelTimeout = null;
      }
    });
  }
}

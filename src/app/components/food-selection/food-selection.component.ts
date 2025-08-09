import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonButton, IonRadioGroup, IonRadio, IonSelect, IonSelectOption, IonIcon, IonGrid, IonRow, IonCol, ToastController } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { createOutline, chevronUpOutline, trashOutline } from 'ionicons/icons';
import { SelectableFoodMatch, SelectableFoodServing, SubmitServingSelectionRequest, UserSelectedServing } from 'src/app/services/nutrition-ambition-api.service';

@Component({
  selector: 'app-food-selection',
  templateUrl: './food-selection.component.html',
  styleUrls: ['./food-selection.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonButton, IonRadioGroup, IonRadio, IonSelect, IonSelectOption, IonIcon, IonGrid, IonRow, IonCol]
})
export class FoodSelectionComponent implements OnInit, OnChanges {
  @Input() foodOptions?: Record<string, SelectableFoodMatch[]> | null = null;
  @Input() mealName?: string | null = null;
  @Input() isReadOnly: boolean = false;
  @Input() messageId?: string;
  @Output() selectionConfirmed = new EventEmitter<SubmitServingSelectionRequest>();

  selections: { [phrase: string]: { foodId: string; servingId?: string } } = {};
  expandedSections: { [phrase: string]: boolean } = {};
  removedPhrases: Set<string> = new Set();
  isSubmitting = false;

  constructor(private toastController: ToastController) {
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
  caloriesForServing(s: SelectableFoodServing | null) { return this.getMacro(s?.nutrients, ['Calories', 'calories', 'energy_kcal', 'Energy']); }
  proteinForServing(s: SelectableFoodServing | null) { return this.getMacro(s?.nutrients, ['Protein', 'protein']); }
  fatForServing(s: SelectableFoodServing | null) { return this.getMacro(s?.nutrients, ['Fat', 'fat', 'total_fat']); }
  carbsForServing(s: SelectableFoodServing | null) { return this.getMacro(s?.nutrients, ['Carbohydrate', 'carbohydrates', 'carbs']); }

  isSelectionComplete(): boolean {
    if (!this.foodOptions) return false;
    return this.payloadKeys.every(phrase => {
      const sel = this.selections[phrase];
      return sel?.foodId && sel?.servingId;
    });
  }

  confirmSelections(): void {
    const req = new SubmitServingSelectionRequest();
    req.pendingMessageId = this.messageId;
    req.selections = [];

    for (const phrase of this.payloadKeys) {
      const food = this.getSelectedFood(phrase);
      const servingId = this.getSelectedServingId(phrase);
      if (food?.fatSecretFoodId && servingId) {
        req.selections.push(new UserSelectedServing({
          originalText: phrase,
          fatSecretFoodId: food.fatSecretFoodId,
          fatSecretServingId: servingId
        }));
      }
    }

    this.isSubmitting = true;
    this.selectionConfirmed.emit(req);
  }

  async removeItem(phrase: string) {
    const rowElement = document.getElementById(`row-${phrase}`);
    if (rowElement) rowElement.classList.add('removing');

    setTimeout(async () => {
      this.removedPhrases.add(phrase);

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
}

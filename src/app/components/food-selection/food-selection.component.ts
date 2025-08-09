import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  IonButton, 
  IonRadioGroup, 
  IonRadio, 
  IonSelect,
  IonSelectOption,
  IonIcon   
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { createOutline, chevronDownOutline, chevronUpOutline } from 'ionicons/icons';
import { SelectableFoodMatch, SelectableFoodServing, UserSelectedServing } from 'src/app/services/nutrition-ambition-api.service';
import { ChatService } from 'src/app/services/chat.service';
import { DateService } from 'src/app/services/date.service';

// Interface definitions
export interface FoodServing {
  servingId: string;
  description: string;
  unit?: string;
  amount?: number;
}

export interface UserSelectedServingRequest {
  originalText: string;
  foodId: string;
  servingId: string;
}

@Component({
  selector: 'app-food-selection',
  templateUrl: './food-selection.component.html',
  styleUrls: ['./food-selection.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonButton,
    IonRadioGroup,
    IonRadio,
    IonSelect,
    IonSelectOption,
    IonIcon
  ]
})
export class FoodSelectionComponent implements OnInit {
  @Input() foodOptions?: Record<string, SelectableFoodMatch[]> | null = null;
  @Input() isReadOnly: boolean = false;
  @Output() selectionConfirmed = new EventEmitter<UserSelectedServingRequest[]>();

  // Map to track selected food and serving: phrase -> { foodId, servingId }
  selections: { [phrase: string]: { foodId: string; servingId?: string } } = {};
  
  // Map to track which sections are expanded
  expandedSections: { [phrase: string]: boolean } = {};

  // Local loading state for submission
  isSubmitting: boolean = false;

  constructor(private chatService: ChatService, private dateService: DateService) {
    addIcons({ createOutline, chevronDownOutline, chevronUpOutline });
  }

  get hasPayload(): boolean {
    return !!this.foodOptions && Object.keys(this.foodOptions).length > 0;
  }

  get payloadKeys(): string[] {
    return this.foodOptions ? Object.keys(this.foodOptions) : [];
  }

  ngOnInit(): void {
    if (!this.foodOptions) return;
  
    for (const phrase of Object.keys(this.foodOptions)) {
      const foods = this.foodOptions[phrase];
      const foodId = foods?.[0]?.fatSecretFoodId;
      const servingId = foods?.[0]?.selectedServingId;
  
      if (foodId) {
        this.selections[phrase] = { foodId, servingId };
      }
      
      // Initialize all sections as collapsed
      this.expandedSections[phrase] = false;
    }
  }

  getTopRankedFood(phrase: string): SelectableFoodMatch | null {
    const foods = this.foodOptions?.[phrase];
    return foods && foods.length > 0 ? foods[0] : null;
  }

  getSelectedFood(phrase: string): SelectableFoodMatch | null {
    const selection = this.selections[phrase];
    if (!selection) return null;
  
    const foods = this.foodOptions?.[phrase];
    return foods?.find(food => food?.fatSecretFoodId === selection.foodId) || null;
  }

  toggleExpansion(phrase: string): void {
    this.expandedSections[phrase] = !this.expandedSections[phrase];
  }

  isExpanded(phrase: string): boolean {
    return !!this.expandedSections[phrase];
  }

  isWeightUnit(unit: string | undefined): boolean {
    if (!unit) return false;
    return ['g', 'gram', 'grams', 'ml', 'milliliter', 'milliliters'].includes(unit.toLowerCase());
  }

  onFoodSelected(phrase: string, foodId: string): void {
    const food = this.foodOptions?.[phrase]?.find(f => f.fatSecretFoodId === foodId);
    
    let defaultServingId: string | undefined;
    
    if (food?.servings && food.servings.length > 0) {
      defaultServingId = food.servings[0].fatSecretServingId;
    }
  
    this.selections[phrase] = { foodId, servingId: defaultServingId };
    //this.expandedSections[phrase] = false;
  }

  onServingSelected(phrase: string, servingId: string): void {
    if (this.selections[phrase]) {
      this.selections[phrase].servingId = servingId;
    }
  }

  getSelectedServingId(phrase: string): string | undefined {
    return this.selections[phrase]?.servingId;
  }

  getSelectedServing(phrase: string): SelectableFoodServing | null {
    const selectedFood = this.getSelectedFood(phrase);
    const selectedServingId = this.getSelectedServingId(phrase);
    
    if (!selectedFood?.servings || !selectedServingId) return null;
    
    return selectedFood.servings.find(serving => serving.fatSecretServingId === selectedServingId) || null;
  }

  getFirstFoodOption(phrase: string): SelectableFoodMatch | null {
    const foods = this.foodOptions?.[phrase];
    return foods && foods.length > 0 ? foods[0] : null;
  }

  getFirstServingOption(phrase: string): SelectableFoodServing | null {
    const firstFood = this.getFirstFoodOption(phrase);
    if (!firstFood?.servings || firstFood.servings.length === 0) return null;
    return firstFood.servings[0];
  }

  isSelectionComplete(): boolean {
    if (!this.foodOptions) return false;
    
    const phrases = Object.keys(this.foodOptions);
    return phrases.every(phrase => {
      const selection = this.selections[phrase];
      return selection?.foodId && selection?.servingId;
    });
  }

  confirmSelections(): void {
    const selections: UserSelectedServingRequest[] = [];

    for (const phrase of this.payloadKeys) {
      const selectedFood = this.getSelectedFood(phrase);
      const selectedServingId = this.getSelectedServingId(phrase);
      if (selectedFood && selectedFood.fatSecretFoodId && selectedServingId) {
        selections.push({
          originalText: phrase,
          foodId: selectedFood.fatSecretFoodId,
          servingId: selectedServingId
        });
      }
    }

    // Show typing indicator while submitting
    this.isSubmitting = true;

    this.chatService.submitServingSelection(selections).subscribe({
      next: (resp) => {
        this.isSubmitting = false;
        if (resp.isSuccess) {
          // Switch to read-only after successful submission
          this.isReadOnly = true;
          // Reload chat to reflect logged entry
          this.chatService.loadMessages();
        } else {
          console.warn('Selection submission failed:', resp.errors);
        }
      },
      error: (err) => {
        this.isSubmitting = false;
        console.error('Error submitting selection:', err);
      }
    });
  }
} 
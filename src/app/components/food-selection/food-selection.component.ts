import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  IonContent, 
  IonHeader, 
  IonToolbar, 
  IonCard, 
  IonItem, 
  IonLabel, 
  IonButton, 
  IonRadioGroup, 
  IonRadio, 
  IonList,
  IonIcon
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { createOutline, chevronDownOutline, chevronUpOutline } from 'ionicons/icons';
import { SelectableFoodMatch, SelectableFoodServing } from 'src/app/services/nutrition-ambition-api.service';

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
    IonContent,
    IonHeader,
    IonToolbar,
    IonCard,
    IonItem,
    IonLabel,
    IonButton,
    IonRadioGroup,
    IonRadio,
    IonList,
    IonIcon
  ]
})
export class FoodSelectionComponent implements OnInit {
  @Input() foodOptions?: Record<string, SelectableFoodMatch[]> | null = null;
  @Output() selectionConfirmed = new EventEmitter<UserSelectedServingRequest[]>();

  // Map to track selected food and serving: phrase -> { foodId, servingId }
  selections: { [phrase: string]: { foodId: string; servingId?: string } } = {};
  
  // Map to track which sections are expanded
  expandedSections: { [phrase: string]: boolean } = {};

  constructor() {
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
  
      if (foodId) {
        this.selections[phrase] = { foodId };
      }
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

  onFoodSelected(phrase: string, foodId: string): void {
    const food = this.foodOptions?.[phrase]?.find(f => f.fatSecretFoodId === foodId);
    
    let defaultServingId: string | undefined;
    
    if (food?.servings && food.servings.length > 0) {
      defaultServingId = food.servings[0].fatSecretServingId;
    }
  
    this.selections[phrase] = { foodId, servingId: defaultServingId };
    this.expandedSections[phrase] = false;
  }

  onServingSelected(phrase: string, servingId: string): void {
    if (this.selections[phrase]) {
      this.selections[phrase].servingId = servingId;
    }
  }

  getSelectedServingId(phrase: string): string | undefined {
    return this.selections[phrase]?.servingId;
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
    if (!this.foodOptions) return;

    const selections: UserSelectedServingRequest[] = [];
    
    for (const phrase in this.selections) {
      const selection = this.selections[phrase];
      if (selection.foodId && selection.servingId) {
        selections.push({
          originalText: phrase,
          foodId: selection.foodId,
          servingId: selection.servingId
        });
      }
    }

    this.selectionConfirmed.emit(selections);
  }
} 
import { Component, Input, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonList, IonItem, IonIcon, IonLabel } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  trashOutline, 
  createOutline, 
  chatboxOutline, 
  navigateOutline, 
  bookOutline,
  statsChartOutline,
  pinOutline,
  notificationsOffOutline,
  flaskOutline
} from 'ionicons/icons';

export type ActionType = 'remove' | 'edit' | 'focusInChat' | 'editGoal' | 'learn' | 'trend' | 'pin' | 'ignore' | 'suggest';

export interface ActionEvent {
  action: ActionType;
  entry: any;
}

@Component({
  selector: 'app-entry-action-menu',
  standalone: true,
  imports: [
    CommonModule,
    IonList,
    IonItem,
    IonIcon,
    IonLabel
  ],
  templateUrl: './entry-action-menu.component.html',
  styleUrls: ['./entry-action-menu.component.scss']
})
export class EntryActionMenuComponent {
  @Input() entry: any;
  @Output() actionSelected = new EventEmitter<ActionEvent>();
  
  constructor() {
    addIcons({
      trashOutline,
      createOutline,
      chatboxOutline,
      navigateOutline,
      bookOutline,
      statsChartOutline,
      pinOutline,
      notificationsOffOutline,
      flaskOutline
    });
  }
  
  getEntryTypeName(): string {
    // Check if the entry has entryType property to determine if it's a food or nutrient
    if (this.entry && this.entry.entryType === 'food') {
      return 'Food';
    }
    return 'Nutrient';
  }
  
  /**
   * Checks if the current entry is a food item
   */
  isFoodEntry(): boolean {
    return this.entry && this.entry.entryType === 'food';
  }
  
  handleAction(action: ActionType) {
    console.log(`Action selected: ${action} for entry:`, this.entry);
    this.actionSelected.emit({ action, entry: this.entry });
  }
} 
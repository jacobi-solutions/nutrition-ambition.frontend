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
  notificationsOffOutline,
  flaskOutline
} from 'ionicons/icons';
import { ToastService } from '../../services/toast.service';

export type ActionType = 'remove' | 'edit' | 'focusInChat' | 'editGoal' | 'learn' | 'trend' | 'ignore' | 'suggest';

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
  
  constructor(private toastService: ToastService) {
    addIcons({
      trashOutline,
      createOutline,
      chatboxOutline,
      navigateOutline,
      bookOutline,
      statsChartOutline,
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
    
    // Check if the action is implemented
    const implementedActions: ActionType[] = ['remove', 'focusInChat', 'learn'];
    
    if (implementedActions.includes(action)) {
      // Emit the event for implemented actions
      this.actionSelected.emit({ action, entry: this.entry });
    } else {
      // Show toast for unimplemented actions
      this.toastService.showToast({
        message: 'Feature not implemented yet. Check back soon!',
        duration: 3000,
        color: 'warning',
        position: 'bottom'
      });
    }
  }
} 
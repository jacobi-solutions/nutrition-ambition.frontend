import { Component, Input, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonList, IonItem, IonIcon, IonLabel } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  trash, 
  create,
  flag,
  school,
  trendingUp,
  eyeOff,
  bulb
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
      trash,
      create,
      flag,
      school,
      trendingUp,
      eyeOff,
      bulb
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
    console.log(`🎯 Action selected: ${action} for entry:`, this.entry);
    
    // Check if the action is implemented
    const implementedActions: ActionType[] = ['remove', 'learn', 'edit'];
    
    if (implementedActions.includes(action)) {
      // Emit the event for implemented actions
      console.log(`✅ Emitting actionSelected event for ${action}`);
      const eventData = { action, entry: this.entry };
      console.log('Event data:', eventData);
      this.actionSelected.emit(eventData);
    } else {
      // Show toast for unimplemented actions and still emit event to dismiss popover
      console.log(`🍞 Showing toast for unimplemented action: ${action}`);
      this.toastService.showToast({
        message: 'Feature not implemented yet. Check back soon!',
        duration: 3000,
        color: 'medium',
        position: 'bottom'
      });
      
      // Still emit the event so the popover dismisses
      const eventData = { action, entry: this.entry };
      this.actionSelected.emit(eventData);
    }
  }
} 
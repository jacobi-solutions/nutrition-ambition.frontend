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
  template: `
    <ion-list>
      <ion-item button (click)="handleAction('remove')" detail="false">
        <ion-icon name="trash-outline" slot="start" color="danger"></ion-icon>
        <ion-label>Remove</ion-label>
      </ion-item>
      
      <ion-item button (click)="handleAction('edit')" detail="false">
        <ion-icon name="create-outline" slot="start" color="primary"></ion-icon>
        <ion-label>Edit</ion-label>
      </ion-item>
      
      <ion-item button (click)="handleAction('focusInChat')" detail="false">
        <ion-icon name="chatbox-outline" slot="start" color="success"></ion-icon>
        <ion-label>Focus in Chat</ion-label>
      </ion-item>
      
      <ion-item button (click)="handleAction('editGoal')" detail="false">
        <ion-icon name="navigate-outline" slot="start" color="tertiary"></ion-icon>
        <ion-label>Create or Modify Goal</ion-label>
      </ion-item>
      
      <ion-item button (click)="handleAction('learn')" detail="false">
        <ion-icon name="book-outline" slot="start" color="secondary"></ion-icon>
        <ion-label>Learn About This {{ getEntryTypeName() }}</ion-label>
      </ion-item>
      
      <ion-item button (click)="handleAction('trend')" detail="false">
        <ion-icon name="stats-chart-outline" slot="start" color="primary"></ion-icon>
        <ion-label>Show Trend</ion-label>
      </ion-item>
      
      <ion-item button (click)="handleAction('pin')" detail="false">
        <ion-icon name="pin-outline" slot="start" color="warning"></ion-icon>
        <ion-label>Pin to Dashboard</ion-label>
      </ion-item>
      
      <ion-item button (click)="handleAction('ignore')" detail="false">
        <ion-icon name="notifications-off-outline" slot="start" color="medium"></ion-icon>
        <ion-label>Ignore for Now</ion-label>
      </ion-item>
      
      <ion-item button (click)="handleAction('suggest')" detail="false">
        <ion-icon name="flask-outline" slot="start" color="success"></ion-icon>
        <ion-label>Suggest Foods</ion-label>
      </ion-item>
    </ion-list>
  `,
  styles: [`
    ion-list {
      margin: 0;
      padding: 0;
    }
    
    ion-item {
      --padding-start: 16px;
      --padding-end: 16px;
    }
    
    ion-icon {
      font-size: 20px;
      margin-right: 8px;
    }
  `]
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
  
  handleAction(action: ActionType) {
    console.log(`Action selected: ${action} for entry:`, this.entry);
    this.actionSelected.emit({ action, entry: this.entry });
  }
} 
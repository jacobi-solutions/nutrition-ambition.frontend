import { Component, Output, EventEmitter, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { 
  IonList,
  IonItem,
  IonIcon,
  IonLabel,
  PopoverController
} from '@ionic/angular/standalone';
import { RouterModule } from '@angular/router';
import { addIcons } from 'ionicons';
import { 
  logOutOutline, 
  downloadOutline,
  informationCircleOutline,
  keyOutline
} from 'ionicons/icons';

@Component({
  selector: 'app-settings-popover',
  templateUrl: './settings-popover.component.html',
  styleUrls: ['./settings-popover.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    IonList,
    IonItem,
    IonIcon,
    IonLabel
  ]
})
export class SettingsPopoverComponent {
  @Input() canInstall: boolean = false;
  @Output() settingsAction = new EventEmitter<{ action: string, event?: Event }>();

  constructor(private popoverCtrl: PopoverController) {
    // Add the icons explicitly to the library
    addIcons({ 
      logOutOutline, 
      downloadOutline,
      informationCircleOutline,
      keyOutline
    });
  }

  onAction(action: string, event?: Event) {
    this.settingsAction.emit({ action, event });
    this.dismiss();
  }

  onNavigateToResetPassword() {
    this.dismiss();
    // Navigation will be handled by the routerLink
  }

  private async dismiss() {
    await this.popoverCtrl.dismiss();
  }
}

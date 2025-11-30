import { Component, Output, EventEmitter, Input, inject } from '@angular/core';
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
  logOut,
  informationCircle,
  personCircle
} from 'ionicons/icons';
import { APP_VERSION } from '../../../environments/version';

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
  @Output() settingsAction = new EventEmitter<{ action: string, event?: Event }>();

  // Expose the app version
  readonly appVersion = APP_VERSION;

  constructor(private popoverCtrl: PopoverController) {
    // Add the icons explicitly to the library
    addIcons({
      logOut,
      informationCircle,
      personCircle
    });
  }

  async onAction(action: string, event?: Event) {
    this.settingsAction.emit({ action, event });
    this.dismiss();
  }

  onNavigateToAccountManagement() {
    this.dismiss();
    // Navigation will be handled by the routerLink
  }

  private async dismiss() {
    await this.popoverCtrl.dismiss();
  }
}

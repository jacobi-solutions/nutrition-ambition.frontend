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
  download,
  informationCircle,
  key,
  refresh
} from 'ionicons/icons';
import { APP_VERSION } from '../../../environments/version';
import { AppUpdateService } from '../../services/app-update.service';

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
  
  // Expose the app version
  readonly appVersion = APP_VERSION;
  
  // Track refresh state
  isRefreshing = false;

  private appUpdateService = inject(AppUpdateService);

  constructor(private popoverCtrl: PopoverController) {
    // Add the icons explicitly to the library
    addIcons({ 
      logOut, 
      download,
      informationCircle,
      key,
      refresh
    });
  }

  async onAction(action: string, event?: Event) {
    this.settingsAction.emit({ action, event });
    this.dismiss();
  }

  async onRefreshToLatest() {
    if (this.isRefreshing) return;
    
    this.isRefreshing = true;
    try {
      await this.appUpdateService.forceReloadToLatest();
    } catch (e) {
      console.warn('[Settings] Failed to refresh to latest:', e);
      this.isRefreshing = false;
    }
    // Note: Page will reload if update is successful, so isRefreshing will reset naturally
  }

  onNavigateToResetPassword() {
    this.dismiss();
    // Navigation will be handled by the routerLink
  }

  private async dismiss() {
    await this.popoverCtrl.dismiss();
  }
}

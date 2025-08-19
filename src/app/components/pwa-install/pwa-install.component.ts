import { Component, Input } from '@angular/core';
import { IonicModule, PopoverController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { addIcons } from 'ionicons';
import { downloadOutline } from 'ionicons/icons';

@Component({
  standalone: true,
  selector: 'app-pwa-install-popover',
  templateUrl: './pwa-install.component.html',
  styleUrls: ['./pwa-install.component.scss'],
  imports: [IonicModule, CommonModule]
})
export class PwaInstallComponent {
  @Input() message: string = '';
  
  constructor(private popoverCtrl: PopoverController) {
    // Add the download icon to the library
    addIcons({ downloadOutline });
  }

  dismissPopover() {
    this.popoverCtrl.dismiss();
  }
}

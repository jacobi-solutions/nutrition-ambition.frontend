import { Component, Input, OnInit } from '@angular/core';
import { IonicModule, PopoverController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { addIcons } from 'ionicons';
import { downloadOutline } from 'ionicons/icons';
import { PwaInstallService } from 'src/app/services/pwa-install.service';

@Component({
  standalone: true,
  selector: 'app-pwa-install-popover',
  templateUrl: './pwa-install.component.html',
  styleUrls: ['./pwa-install.component.scss'],
  imports: [IonicModule, CommonModule]
})
export class PwaInstallComponent implements OnInit {
  message: string = '';

  constructor(
    private popoverCtrl: PopoverController,
    private installService: PwaInstallService
  ) {
    addIcons({ downloadOutline });
  }

  ngOnInit() {
    this.message = this.installService.getInstallMessage();
  }

  dismissPopover() {
    this.popoverCtrl.dismiss();
  }
}

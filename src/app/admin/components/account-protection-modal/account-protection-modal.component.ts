import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon,
  IonContent, IonNote,
  ModalController
} from '@ionic/angular/standalone';
import { Account } from '../../../services/nutrition-ambition-api.service';
import { addIcons } from 'ionicons';
import {
  closeOutline,
  lockOpenOutline,
  trashOutline,
  refreshOutline,
  warningOutline,
  shieldOutline
} from 'ionicons/icons';

addIcons({
  'close-outline': closeOutline,
  'lock-open-outline': lockOpenOutline,
  'trash-outline': trashOutline,
  'refresh-outline': refreshOutline,
  'warning-outline': warningOutline,
  'shield-outline': shieldOutline
});

export type UnlockType = 'clear' | 'delete' | 'both';

export interface AccountProtectionResult {
  unlocked: boolean;
  unlockType?: UnlockType;
}

@Component({
  selector: 'app-account-protection-modal',
  standalone: true,
  imports: [
    CommonModule,
    IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon,
    IonContent, IonNote
  ],
  templateUrl: './account-protection-modal.component.html',
  styleUrls: ['./account-protection-modal.component.scss']
})
export class AccountProtectionModalComponent implements OnInit {
  @Input() account!: Account;

  constructor(
    private modalController: ModalController
  ) {}

  ngOnInit() {}

  dismiss() {
    const result: AccountProtectionResult = { unlocked: false };
    this.modalController.dismiss(result);
  }

  unlockForClear() {
    const result: AccountProtectionResult = { unlocked: true, unlockType: 'clear' };
    this.modalController.dismiss(result);
  }

  unlockForDelete() {
    const result: AccountProtectionResult = { unlocked: true, unlockType: 'delete' };
    this.modalController.dismiss(result);
  }

  unlockForBoth() {
    const result: AccountProtectionResult = { unlocked: true, unlockType: 'both' };
    this.modalController.dismiss(result);
  }
}

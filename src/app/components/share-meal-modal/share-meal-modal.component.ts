import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonIcon,
  IonContent,
  IonText,
  ModalController
} from '@ionic/angular/standalone';
import { QRCodeComponent } from 'angularx-qrcode';
import { addIcons } from 'ionicons';
import { close, copyOutline, shareSocialOutline } from 'ionicons/icons';
import { ToastService } from '../../services/toast.service';
import { AnalyticsService } from '../../services/analytics.service';

@Component({
  selector: 'app-share-meal-modal',
  templateUrl: './share-meal-modal.component.html',
  styleUrls: ['./share-meal-modal.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonIcon,
    IonContent,
    IonText,
    QRCodeComponent
  ]
})
export class ShareMealModalComponent {
  @Input() shareUrl: string = '';
  @Input() mealName: string = '';
  @Input() expiresDate: Date = new Date();

  constructor(
    private modalCtrl: ModalController,
    private toastService: ToastService,
    private analytics: AnalyticsService
  ) {
    addIcons({ close, copyOutline, shareSocialOutline });
  }

  async copyLink() {
    try {
      // Use modern Clipboard API
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(this.shareUrl);
        this.toastService.showToast({
          message: 'Link copied to clipboard!',
          color: 'success'
        });

        this.analytics.trackEvent('meal_share_link_copied', {
          mealName: this.mealName
        });
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = this.shareUrl;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        this.toastService.showToast({
          message: 'Link copied to clipboard!',
          color: 'success'
        });
      }
    } catch (error) {
      this.toastService.showToast({
        message: 'Failed to copy link',
        color: 'danger'
      });
    }
  }

  async nativeShare() {
    try {
      // Check if Web Share API is available
      if (navigator.share) {
        await navigator.share({
          title: `Check out my ${this.mealName}`,
          text: `I'm sharing my ${this.mealName} with you. Scan the QR code or click the link to add it to your nutrition tracker!`,
          url: this.shareUrl
        });

        this.analytics.trackEvent('meal_share_native_shared', {
          mealName: this.mealName
        });
      } else {
        // Fallback to copy if share not available
        await this.copyLink();
      }
    } catch (error: any) {
      // User cancelled share or error occurred
      if (error.name !== 'AbortError') {
        this.toastService.showToast({
          message: 'Failed to share',
          color: 'danger'
        });
      }
    }
  }

  closeModal() {
    this.modalCtrl.dismiss();
  }
}

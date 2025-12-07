import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon,
  IonContent, IonSpinner, IonNote,
  ModalController
} from '@ionic/angular/standalone';
import { Account } from '../../../services/nutrition-ambition-api.service';
import { AdminService } from '../../services/admin.service';
import { ToastService } from '../../../services/toast.service';
import { addIcons } from 'ionicons';
import {
  closeOutline,
  removeOutline,
  addOutline,
  calendarOutline,
  checkmarkOutline
} from 'ionicons/icons';

addIcons({
  'close-outline': closeOutline,
  'remove-outline': removeOutline,
  'add-outline': addOutline,
  'calendar-outline': calendarOutline,
  'checkmark-outline': checkmarkOutline
});

@Component({
  selector: 'app-adjust-dates-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon,
    IonContent, IonSpinner, IonNote
  ],
  templateUrl: './adjust-dates-modal.component.html',
  styleUrls: ['./adjust-dates-modal.component.scss']
})
export class AdjustDatesModalComponent implements OnInit {
  @Input() account!: Account;

  // Single day shift value - negative moves everything back in time
  dayShift = -1;

  isSubmitting = false;

  constructor(
    private modalController: ModalController,
    private adminService: AdminService,
    private toastService: ToastService
  ) {}

  ngOnInit() {}

  dismiss() {
    this.modalController.dismiss();
  }

  decrementDayShift() {
    this.dayShift--;
  }

  incrementDayShift() {
    this.dayShift++;
  }

  // Format date for display
  formatDate(date: Date | string | undefined | null): string {
    if (!date) return 'Not set';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Calculate what the new created date would be
  getProjectedCreatedDate(): Date | null {
    if (!this.account.createdDateUtc) return null;
    const date = new Date(this.account.createdDateUtc);
    date.setDate(date.getDate() + this.dayShift);
    return date;
  }

  // Calculate what the new trial end date would be
  getProjectedTrialEndDate(): Date | null {
    if (!this.account.trialEndDateUtc) return null;
    const date = new Date(this.account.trialEndDateUtc);
    date.setDate(date.getDate() + this.dayShift);
    return date;
  }

  async applyShift() {
    if (this.dayShift === 0) return;

    this.isSubmitting = true;
    try {
      const response = await this.adminService.adjustAccountDates(
        this.account.id!,
        this.dayShift
      );

      if (response.isSuccess) {
        // Build detailed message
        const parts: string[] = [];
        if (response.totalUpdated && response.totalUpdated > 0) {
          parts.push(`${response.totalUpdated} records shifted`);
        }
        if (response.totalDeleted && response.totalDeleted > 0) {
          parts.push(`${response.totalDeleted} future-dated records deleted`);
        }

        const message = parts.length > 0
          ? `Dates shifted by ${this.dayShift} days. ${parts.join(', ')}.`
          : `Dates shifted by ${this.dayShift} days.`;

        await this.toastService.showToast({
          message: message,
          duration: 4000,
          color: 'success'
        });

        // Update local account data
        if (this.account.createdDateUtc) {
          const newCreated = new Date(this.account.createdDateUtc);
          newCreated.setDate(newCreated.getDate() + this.dayShift);
          this.account.createdDateUtc = newCreated;
        }
        if (this.account.trialEndDateUtc) {
          const newTrialEnd = new Date(this.account.trialEndDateUtc);
          newTrialEnd.setDate(newTrialEnd.getDate() + this.dayShift);
          this.account.trialEndDateUtc = newTrialEnd;
        }

        this.dayShift = -1; // Reset to default
      } else {
        await this.toastService.showToast({
          message: response.errors?.[0]?.errorMessage || 'Failed to shift dates',
          duration: 3000,
          color: 'danger'
        });
      }
    } catch (error) {
      await this.toastService.showToast({
        message: 'Error shifting dates',
        duration: 3000,
        color: 'danger'
      });
    } finally {
      this.isSubmitting = false;
    }
  }
}

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

  // Created date adjustment (for moving start date back)
  createdDateAdjustment = -3; // Default to -3 days (move back 3 days)

  // Trial end date adjustment
  trialEndDateAdjustment = 0;

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

  // Created date controls
  decrementCreatedDate() {
    this.createdDateAdjustment--;
  }

  incrementCreatedDate() {
    this.createdDateAdjustment++;
  }

  // Trial end date controls
  decrementTrialEndDate() {
    this.trialEndDateAdjustment--;
  }

  incrementTrialEndDate() {
    this.trialEndDateAdjustment++;
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

  // Calculate what the new date would be
  getProjectedCreatedDate(): Date | null {
    if (!this.account.createdDateUtc) return null;
    const date = new Date(this.account.createdDateUtc);
    date.setDate(date.getDate() + this.createdDateAdjustment);
    return date;
  }

  getProjectedTrialEndDate(): Date | null {
    if (!this.account.trialEndDateUtc && this.trialEndDateAdjustment === 0) return null;
    if (!this.account.trialEndDateUtc) {
      // If no trial end date, it will be created from now + adjustment
      const date = new Date();
      date.setDate(date.getDate() + this.trialEndDateAdjustment);
      return date;
    }
    const date = new Date(this.account.trialEndDateUtc);
    date.setDate(date.getDate() + this.trialEndDateAdjustment);
    return date;
  }

  // Check if any changes are pending
  hasChanges(): boolean {
    return this.createdDateAdjustment !== 0 || this.trialEndDateAdjustment !== 0;
  }

  async applyCreatedDateChange() {
    if (this.createdDateAdjustment === 0) return;

    this.isSubmitting = true;
    try {
      const response = await this.adminService.adjustAccountDates(
        this.account.id!,
        this.createdDateAdjustment,
        undefined
      );

      if (response.isSuccess) {
        await this.toastService.showToast({
          message: `Created date adjusted by ${this.createdDateAdjustment} days`,
          duration: 3000,
          color: 'success'
        });
        // Update local account data
        if (response.newCreatedDateUtc) {
          this.account.createdDateUtc = response.newCreatedDateUtc;
        }
        this.createdDateAdjustment = 0;
      } else {
        await this.toastService.showToast({
          message: response.errors?.[0]?.errorMessage || 'Failed to adjust created date',
          duration: 3000,
          color: 'danger'
        });
      }
    } catch (error) {
      await this.toastService.showToast({
        message: 'Error adjusting created date',
        duration: 3000,
        color: 'danger'
      });
    } finally {
      this.isSubmitting = false;
    }
  }

  async applyTrialEndDateChange() {
    if (this.trialEndDateAdjustment === 0) return;

    this.isSubmitting = true;
    try {
      const response = await this.adminService.adjustAccountDates(
        this.account.id!,
        undefined,
        this.trialEndDateAdjustment
      );

      if (response.isSuccess) {
        await this.toastService.showToast({
          message: `Trial end date adjusted by ${this.trialEndDateAdjustment} days`,
          duration: 3000,
          color: 'success'
        });
        // Update local account data
        if (response.newTrialEndDateUtc) {
          this.account.trialEndDateUtc = response.newTrialEndDateUtc;
        }
        this.trialEndDateAdjustment = 0;
      } else {
        await this.toastService.showToast({
          message: response.errors?.[0]?.errorMessage || 'Failed to adjust trial end date',
          duration: 3000,
          color: 'danger'
        });
      }
    } catch (error) {
      await this.toastService.showToast({
        message: 'Error adjusting trial end date',
        duration: 3000,
        color: 'danger'
      });
    } finally {
      this.isSubmitting = false;
    }
  }
}

import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { AuthService } from '../../../services/auth.service';
import { ToastService } from '../../../services/toast.service';
import { Router, RouterModule } from '@angular/router';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonGrid, IonRow, IonCol, IonItem, IonLabel, IonInput, IonButton, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonInputPasswordToggle } from '@ionic/angular/standalone';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-change-password',
  templateUrl: './change-password.page.html',
  styleUrls: ['./change-password.page.scss'],
  standalone: true,
  imports: [
    FormsModule,
    RouterModule,

    // Required standalone components
    IonContent,
    IonInput, IonButton, IonInputPasswordToggle
  ],
})
export class ChangePasswordPage {
  currentPassword: string = '';
  newPassword: string = '';
  confirmPassword: string = '';
  isWorking: boolean = false;

  constructor(
    private authService: AuthService, 
    private router: Router,
    private toastService: ToastService
  ) {}

  async onResetPassword() {
    if (this.newPassword !== this.confirmPassword) {
      await this.toastService.showToast({
        message: 'New passwords do not match',
        color: 'danger',
        duration: 3000
      });
      return;
    }

    if (this.newPassword.length < 8) {
      await this.toastService.showToast({
        message: 'New password must be at least 8 characters',
        color: 'danger',
        duration: 3000
      });
      return;
    }

    if (!this.currentPassword.trim()) {
      await this.toastService.showToast({
        message: 'Current password is required',
        color: 'danger',
        duration: 3000
      });
      return;
    }

    this.isWorking = true;
    
    try {
      await this.authService.changePassword(this.currentPassword, this.newPassword);
      
      // Show success toast
      await this.toastService.showToast({
        message: 'Password has been changed successfully!',
        color: 'success',
        duration: 3000
      });
      
      // Navigate back to the previous page or chat
      this.router.navigate(['/app/chat']);
    } catch (error) {
      await this.toastService.showToast({
        message: error instanceof Error ? error.message : 'Failed to change password. Please try again.',
        color: 'danger',
        duration: 3000
      });
    } finally {
      this.isWorking = false;
    }
  }

  navigateToLogin() {
    this.router.navigate(['/login']);
  }
}

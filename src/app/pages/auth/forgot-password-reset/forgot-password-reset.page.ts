import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { AuthService } from '../../../services/auth.service';
import { ToastService } from '../../../services/toast.service';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonGrid, IonRow, IonCol, IonItem, IonLabel, IonInput, IonButton, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonInputPasswordToggle } from '@ionic/angular/standalone';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-forgot-password-reset',
  templateUrl: './forgot-password-reset.page.html',
  styleUrls: ['./forgot-password-reset.page.scss'],
  standalone: true,
  imports: [
    FormsModule,
    RouterModule,

    // Required standalone components
    IonContent,
    IonInput, IonButton, IonInputPasswordToggle
  ],
})
export class ForgotPasswordResetPage implements OnInit {
  newPassword: string = '';
  confirmPassword: string = '';
  isWorking: boolean = false;
  userEmail: string = '';
  oobCode: string = '';

  constructor(
    private authService: AuthService, 
    private router: Router,
    private route: ActivatedRoute,
    private toastService: ToastService
  ) {}

  async ngOnInit() {
    // Get the oobCode from URL parameters (sent by Firebase in reset email)
    this.route.queryParams.subscribe(async params => {
      this.oobCode = params['oobCode'] || '';
      if (!this.oobCode) {
        // If no code, redirect to login
        this.router.navigate(['/login']);
        return;
      }

      // Verify the code and get the email address
      try {
        this.userEmail = await this.authService.verifyPasswordResetCode(this.oobCode);
      } catch (error) {
        console.error('Error verifying reset code:', error);
        await this.toastService.showToast({
          message: error instanceof Error ? error.message : 'Invalid or expired reset link.',
          color: 'danger',
          duration: 5000
        });
        this.router.navigate(['/login']);
      }
    });
  }

  async onResetPassword() {
    if (this.newPassword !== this.confirmPassword) {
      await this.toastService.showToast({
        message: 'Passwords do not match',
        color: 'danger',
        duration: 3000
      });
      return;
    }

    if (this.newPassword.length < 8) {
      await this.toastService.showToast({
        message: 'Password must be at least 8 characters',
        color: 'danger',
        duration: 3000
      });
      return;
    }

    if (!this.oobCode) {
      await this.toastService.showToast({
        message: 'Invalid reset link. Please request a new password reset.',
        color: 'danger',
        duration: 3000
      });
      return;
    }

    this.isWorking = true;
    
    try {
      await this.authService.confirmPasswordReset(this.oobCode, this.newPassword);
      
      // Show success toast
      await this.toastService.showToast({
        message: 'Password has been reset successfully! Please log in with your new password.',
        color: 'success',
        duration: 5000
      });
      
      // Navigate to login page
      this.router.navigate(['/login']);
    } catch (error) {
      console.error('Password reset failed:', error);
      await this.toastService.showToast({
        message: error instanceof Error ? error.message : 'Failed to reset password. Please try again or request a new reset link.',
        color: 'danger',
        duration: 5000
      });
    } finally {
      this.isWorking = false;
    }
  }

  navigateToLogin() {
    this.router.navigate(['/login']);
  }

  getDisplayName(): string {
    if (this.userEmail && this.userEmail !== 'your account' && this.userEmail !== '') {
      // Extract the part before @ for a cleaner display
      const username = this.userEmail;
      return username || this.userEmail;
    }
    return 'your account';
  }
}

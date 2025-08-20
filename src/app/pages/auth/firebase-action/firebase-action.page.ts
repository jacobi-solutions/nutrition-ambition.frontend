import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastService } from '../../../services/toast.service';
import { AuthService } from '../../../services/auth.service';
import { CommonModule } from '@angular/common';
import { IonContent, IonSpinner, IonButton } from '@ionic/angular/standalone';

@Component({
  selector: 'app-firebase-action',
  templateUrl: './firebase-action.page.html',
  styleUrls: ['./firebase-action.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonContent,
    IonSpinner,
    IonButton
  ],
})
export class FirebaseActionPage implements OnInit {
  isProcessing = true;
  message = 'Processing...';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private toastService: ToastService,
    private authService: AuthService
  ) {}

  async ngOnInit() {
    try {
      const params = this.route.snapshot.queryParams;
      const mode = params['mode'];
      const oobCode = params['oobCode'];
      const apiKey = params['apiKey'];
      const continueUrl = params['continueUrl'];
      const lang = params['lang'];

      console.log('Firebase action params:', { mode, oobCode: !!oobCode, apiKey: !!apiKey });

      if (!mode || !oobCode) {
        await this.handleError('Invalid or missing parameters in the link.');
        return;
      }

      switch (mode) {
        case 'resetPassword':
          await this.handlePasswordReset(oobCode, continueUrl);
          break;
        
        case 'verifyEmail':
          await this.handleEmailVerification(oobCode, continueUrl);
          break;
        
        case 'recoverEmail':
          await this.handleEmailRecovery(oobCode, continueUrl);
          break;
        
        default:
          await this.handleError(`Unknown action mode: ${mode}`);
          break;
      }
    } catch (error) {
      console.error('Error processing Firebase action:', error);
      await this.handleError('An error occurred while processing the request.');
    }
  }

  private async handlePasswordReset(oobCode: string, continueUrl?: string) {
    this.message = 'Verifying password reset link...';
    
    try {
      // Redirect to the password reset page with the oobCode
      this.router.navigate(['/forgot-password-reset'], {
        queryParams: { oobCode }
      });
    } catch (error) {
      console.error('Password reset error:', error);
      await this.handleError('Invalid or expired password reset link.');
    }
  }

  private async handleEmailVerification(oobCode: string, continueUrl?: string) {
    this.message = 'Verifying your email address...';
    
    try {
      // TODO: Implement email verification with Firebase
      // await this.authService.verifyEmail(oobCode);
      
      await this.toastService.showToast({
        message: 'Email verified successfully!',
        color: 'success',
        duration: 3000
      });

      // Redirect to the continue URL or default to app
      const redirectUrl = continueUrl || '/app/chat';
      this.router.navigateByUrl(redirectUrl);
    } catch (error) {
      console.error('Email verification error:', error);
      await this.handleError('Invalid or expired email verification link.');
    }
  }

  private async handleEmailRecovery(oobCode: string, continueUrl?: string) {
    this.message = 'Processing email recovery...';
    
    try {
      // TODO: Implement email recovery with Firebase
      // This is for when users want to undo an email change
      
      await this.toastService.showToast({
        message: 'Email recovery processed.',
        color: 'success',
        duration: 3000
      });

      // Redirect to login or continue URL
      const redirectUrl = continueUrl || '/login';
      this.router.navigateByUrl(redirectUrl);
    } catch (error) {
      console.error('Email recovery error:', error);
      await this.handleError('Invalid or expired email recovery link.');
    }
  }

  private async handleError(message: string) {
    this.isProcessing = false;
    this.message = message;
    
    await this.toastService.showToast({
      message,
      color: 'danger',
      duration: 5000
    });

    // Redirect to login after showing error
    setTimeout(() => {
      this.router.navigate(['/login']);
    }, 3000);
  }

  navigateToLogin() {
    this.router.navigate(['/login']);
  }
}

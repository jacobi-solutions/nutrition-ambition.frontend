import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { AuthService } from '../../../services/auth.service';
import { ToastService } from '../../../services/toast.service';
import { Router, RouterModule } from '@angular/router';
import { IonContent, IonInput, IonButton, IonInputPasswordToggle, IonCheckbox } from '@ionic/angular/standalone';

@Component({
  selector: 'app-beta-signup',
  templateUrl: './beta-signup.page.html',
  styleUrls: ['./beta-signup.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    IonContent,
    IonInput, IonButton, IonInputPasswordToggle, IonCheckbox
  ],
})
export class BetaSignupPage implements OnInit {
  email: string = '';
  password: string = '';
  confirmPassword: string = '';
  termsAccepted: boolean = false;
  isWorking: boolean = false;
  isValidLink: boolean = true;

  constructor(
    private authService: AuthService,
    private router: Router,
    private toastService: ToastService
  ) {}

  async ngOnInit() {
    // Check if this is a valid email link
    const url = window.location.href;
    if (!this.authService.isSignInWithEmailLink(url)) {
      this.isValidLink = false;
      await this.toastService.showToast({
        message: 'Invalid sign-in link',
        color: 'danger',
        duration: 3000
      });
      return;
    }

    // Get email from localStorage (stored when link was generated)
    let email = window.localStorage.getItem('emailForSignIn');
    if (!email) {
      // If not in localStorage, prompt user for it
      email = window.prompt('Please provide your email for confirmation');
    }

    if (!email) {
      this.isValidLink = false;
      await this.toastService.showToast({
        message: 'Email is required to complete sign-in',
        color: 'danger',
        duration: 3000
      });
      return;
    }

    this.email = email;

    // Sign in with email link
    try {
      await this.authService.signInWithEmailLink(email, url);
      // Clear the email from storage
      window.localStorage.removeItem('emailForSignIn');
      
      // User is now signed in, they can set their password
      await this.toastService.showToast({
        message: 'Email verified! Please set your password.',
        color: 'success',
        duration: 2000
      });
    } catch (error) {
      this.isValidLink = false;
      let errorMessage = 'The login link you\'re using is expired or invalid. Please request a new one.';

      // Check if it's specifically an invalid-action-code error
      if (error instanceof Error && error.message.includes('invalid-action-code')) {
        errorMessage = 'The login link you\'re using is expired or invalid. Please request a new one.';
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      await this.toastService.showToast({
        message: errorMessage,
        color: 'danger',
        duration: 3000
      });
    }
  }

  async onBetaSignup() {
    if (!this.password.trim()) {
      await this.toastService.showToast({
        message: 'Password is required',
        color: 'danger',
        duration: 1500
      });
      return;
    }

    if (this.password.length < 8) {
      await this.toastService.showToast({
        message: 'Password must be at least 8 characters',
        color: 'danger',
        duration: 1500
      });
      return;
    }

    if (this.password !== this.confirmPassword) {
      await this.toastService.showToast({
        message: 'Passwords do not match',
        color: 'danger',
        duration: 1500
      });
      return;
    }

    this.isWorking = true;

    try {
      // Update the Firebase user's password using the existing ChangePassword endpoint
      // The user is already signed in via email link, so we can just set their password
      await this.authService.setBetaUserPassword(this.password);

      await this.toastService.showToast({
        message: 'Account setup complete! Welcome to Nutrition Ambition.',
        color: 'success',
        duration: 2000
      });

      // Navigate to app
      this.router.navigate(['/app/chat']);
    } catch (error) {
      await this.toastService.showToast({
        message: error instanceof Error ? error.message : 'Failed to set password. Please try again.',
        color: 'danger',
        duration: 2000
      });
    } finally {
      this.isWorking = false;
    }
  }

  navigateToChat() {
    this.router.navigate(['/app/chat']);
  }

  canSubmit(): boolean {
    return !this.isWorking &&
           this.isValidLink &&
           this.password.length >= 8 &&
           this.password === this.confirmPassword &&
           this.termsAccepted;
  }
}

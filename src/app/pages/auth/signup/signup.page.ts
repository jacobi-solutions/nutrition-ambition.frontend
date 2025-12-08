import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule, NavController } from '@ionic/angular';
import { AuthService } from '../../../services/auth.service';
import { ToastService } from '../../../services/toast.service';
import { AccountsService } from '../../../services/accounts.service';
import { Router, RouterModule } from '@angular/router';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonGrid, IonRow, IonCol, IonItem, IonLabel, IonInput, IonButton, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonInputPasswordToggle, IonCheckbox } from '@ionic/angular/standalone';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-signup',
  templateUrl: './signup.page.html',
  styleUrls: ['./signup.page.scss'],
  standalone: true,
  imports: [
    FormsModule,
    RouterModule,

    // Required standalone components
    IonContent,
    IonInput, IonButton, IonInputPasswordToggle, IonCheckbox
  ],
})
export class SignupPage {
  email: string = '';
  password: string = '';
  confirmPassword: string = '';
  termsAccepted: boolean = false;
  isWorking: boolean = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    private navController: NavController,
    private toastService: ToastService,
    private accountsService: AccountsService
  ) {}

  async onSignup() {
    if (!this.email.trim()) {
      await this.toastService.showToast({
        message: 'Email is required',
        color: 'danger',
        duration: 1500
      });
      return;
    }

    if (!this.termsAccepted) {
      await this.toastService.showToast({
        message: 'Please accept the Terms of Use and Privacy Policy',
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
      console.log('[SignupPage] Starting registerWithEmail...');
      await this.authService.registerWithEmail(this.email, this.password);
      console.log('[SignupPage] registerWithEmail completed');

      // Refresh account data so isRestrictedAccess is updated
      console.log('[SignupPage] Loading account...');
      await this.accountsService.loadAccount();
      console.log('[SignupPage] Account loaded');

      // Show success toast
      await this.toastService.showToast({
        message: 'Account created. You\'re all set!',
        color: 'success',
        duration: 1500
      });

      // Navigate to chat - backend handles conversation continuation via Account.NeedsContinuationAfterUpgrade flag
      console.log('[SignupPage] Navigating to chat...');
      this.navController.navigateBack('/app/chat');
    } catch (error) {
      await this.toastService.showToast({
        message: error instanceof Error ? error.message : 'Failed to create account. Please try again.',
        color: 'danger',
        duration: 1500
      });
    } finally {
      this.isWorking = false;
    }
  }

  navigateToChat() {
    this.router.navigate(['/app/chat']);
  }

  async onContinueAsGuest(): Promise<void> {
    if (this.isWorking) return;
    this.isWorking = true;
    try {
      await this.authService.startAnonymousSession();
      this.router.navigateByUrl('/app/chat');
    } catch (error) {
      // Continue as Guest failed
    } finally {
      this.isWorking = false;
    }
  }
} 
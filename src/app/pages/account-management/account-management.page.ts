import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import {
  IonContent,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonButton,
  IonSpinner,
  IonItem,
  IonLabel,
  IonText,
  AlertController,
  LoadingController
} from '@ionic/angular/standalone';
import { Browser } from '@capacitor/browser';
import { lastValueFrom } from 'rxjs';
import { AppHeaderComponent } from 'src/app/components/header/header.component';
import { NutritionAmbitionApiService, Account, SubscriptionStatus, CreateCheckoutSessionRequest } from 'src/app/services/nutrition-ambition-api.service';
import { AuthService } from 'src/app/services/auth.service';
import { AccountsService } from 'src/app/services/accounts.service';
import { PlatformService } from 'src/app/services/platform.service';
import { AnalyticsService } from 'src/app/services/analytics.service';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-account-management',
  templateUrl: './account-management.page.html',
  styleUrls: ['./account-management.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    AppHeaderComponent,
    IonContent,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonButton,
    IonSpinner,
    IonItem,
    IonLabel,
    IonText
  ],
})
export class AccountManagementPage implements OnInit {
  accountInfo: Account | null = null;
  isLoading = true;
  SubscriptionStatus = SubscriptionStatus;
  showReturnToApp = false;

  constructor(
    private apiService: NutritionAmbitionApiService,
    private authService: AuthService,
    private accountsService: AccountsService,
    private platformService: PlatformService,
    private analyticsService: AnalyticsService,
    private alertController: AlertController,
    private loadingController: LoadingController,
    private router: Router
  ) {}

  async ngOnInit() {
    // Check if user came from mobile app
    this.showReturnToApp = sessionStorage.getItem('authSource') === 'app';

    await this.loadAccountInfo();
  }

  async loadAccountInfo() {
    this.isLoading = true;
    try {
      await this.accountsService.loadAccount();
      this.accountInfo = this.accountsService.currentAccount;
    } catch (error) {
      console.error('Error loading account info:', error);
      await this.showError('Failed to load account information');
    } finally {
      this.isLoading = false;
    }
  }

  get subscriptionStatusText(): string {
    if (!this.accountInfo) return '';

    if (this.accountInfo.isPremiumLifetime) {
      return 'Lifetime Premium';
    }

    if (!this.accountInfo.isPremium) {
      return 'Free Trial';
    }

    switch (this.accountInfo.subscriptionStatus) {
      case SubscriptionStatus.Active:
        return 'Active';
      case SubscriptionStatus.Canceled:
        return 'Canceled (Active until period end)';
      case SubscriptionStatus.PastDue:
        return 'Past Due';
      case SubscriptionStatus.Trial:
        return 'Trial';
      case SubscriptionStatus.Incomplete:
        return 'Incomplete';
      case SubscriptionStatus.Expired:
        return 'Expired';
      default:
        return 'Unknown';
    }
  }

  get isMobileApp(): boolean {
    return this.platformService.isNative();
  }

  get canCancelSubscription(): boolean {
    return this.accountInfo?.isPremium === true
      && this.accountInfo?.isPremiumLifetime === false
      && this.accountInfo?.subscriptionStatus !== SubscriptionStatus.Canceled;
  }

  async cancelSubscription() {
    const alert = await this.alertController.create({
      header: 'Cancel Subscription',
      message: 'Are you sure you want to cancel your subscription? You will retain premium access until the end of your billing period.',
      cssClass: 'custom-alert',
      buttons: [
        {
          text: 'No, Keep Subscription',
          role: 'cancel'
        },
        {
          text: 'Yes, Cancel',
          role: 'destructive',
          handler: async () => {
            await this.performCancelSubscription();
          }
        }
      ]
    });

    await alert.present();
  }

  private async performCancelSubscription() {
    const loading = await this.loadingController.create({
      message: 'Canceling subscription...',
      cssClass: 'custom-loading'
    });
    await loading.present();

    try {
      const response = await lastValueFrom(this.apiService.cancelSubscription());
      if (response?.isSuccess) {
        await this.showSuccess('Subscription canceled successfully. You will retain access until the end of your billing period.');
        await this.loadAccountInfo();
      } else {
        await this.showError(response?.errors?.[0]?.errorMessage || 'Failed to cancel subscription');
      }
    } catch (error) {
      console.error('Error canceling subscription:', error);
      await this.showError('Failed to cancel subscription');
    } finally {
      await loading.dismiss();
    }
  }

  async deleteAccount() {
    const alert = await this.alertController.create({
      header: 'Delete Account',
      message: 'Are you sure you want to permanently delete your account? This action cannot be undone and will delete all your data.',
      cssClass: 'custom-alert',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Delete Account',
          role: 'destructive',
          handler: async () => {
            await this.confirmDeleteAccount();
          }
        }
      ]
    });

    await alert.present();
  }

  private async confirmDeleteAccount() {
    const alert = await this.alertController.create({
      header: 'Final Confirmation',
      message: 'This is your final warning. Deleting your account will permanently erase all your data and cancel any active subscriptions. Type DELETE to confirm.',
      cssClass: 'custom-alert',
      inputs: [
        {
          name: 'confirmation',
          type: 'text',
          placeholder: 'Type DELETE'
        }
      ],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Delete Forever',
          role: 'destructive',
          handler: async (data) => {
            if (data.confirmation === 'DELETE') {
              await this.performDeleteAccount();
              return true;
            } else {
              await this.showError('You must type DELETE to confirm account deletion');
              return false;
            }
          }
        }
      ]
    });

    await alert.present();
  }

  private async performDeleteAccount() {
    const loading = await this.loadingController.create({
      message: 'Deleting account...',
      cssClass: 'custom-loading'
    });
    await loading.present();

    try {
      const response = await lastValueFrom(this.apiService.deleteAccount());
      if (response?.isSuccess) {
        await loading.dismiss();
        await this.showSuccess('Your account has been deleted successfully.');
        await this.authService.signOutUser();
        this.router.navigate(['/login']);
      } else {
        await this.showError(response?.errors?.[0]?.errorMessage || 'Failed to delete account');
      }
    } catch (error) {
      console.error('Error deleting account:', error);
      await this.showError('Failed to delete account');
    } finally {
      await loading.dismiss();
    }
  }

  private async showSuccess(message: string) {
    const alert = await this.alertController.create({
      header: 'Success',
      message,
      cssClass: 'custom-alert',
      buttons: ['OK']
    });
    await alert.present();
  }

  private async showError(message: string) {
    const alert = await this.alertController.create({
      header: 'Error',
      message,
      cssClass: 'custom-alert',
      buttons: ['OK']
    });
    await alert.present();
  }

  formatDate(date: Date | undefined | null): string {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString();
  }

  returnToApp() {
    sessionStorage.removeItem('authSource');
    window.location.href = 'nutritionambition://';
  }

  async openWebAccountManagement() {
    // Track that user requested handoff
    this.analyticsService.trackEvent('auth_handoff_requested');

    const loading = await this.loadingController.create({
      message: 'Preparing...',
      cssClass: 'custom-loading'
    });
    await loading.present();

    try {
      const response = await lastValueFrom(this.apiService.createAuthHandoffToken('/account-management'));

      await loading.dismiss();

      if (response?.isSuccess && response.handoffUrl) {
        console.log('Handoff URL:', response.handoffUrl);
        console.log('Handoff URL length:', response.handoffUrl.length);
        console.log('URL has token param:', response.handoffUrl.includes('?token='));
        // Try using _blank instead of _system to use in-app browser
        // _system was stripping the query params when opening Safari
        await Browser.open({
          url: response.handoffUrl,
          windowName: '_blank'
        });
      } else {
        console.error('Failed to create handoff token:', response?.errors);
        await this.showError('Unable to open account management. Please try again.');
      }
    } catch (error) {
      await loading.dismiss();
      console.error('Error creating auth handoff:', error);
      await this.showError('Failed to open browser. Please try again.');
    }
  }

  async openStripeCheckout(tier: 'monthly' | '6months' | 'annual' | 'lifetime') {
    if (!this.accountInfo) {
      await this.showError('Account information not available');
      return;
    }

    // Map tier to actual Stripe price IDs from environment variables
    // These must match the price IDs configured in backend appsettings.json
    const priceIdMap = {
      monthly: this.accountInfo.isEarlyAccess
        ? environment.stripePrices.earlyMonthly
        : environment.stripePrices.publicMonthly,
      '6months': this.accountInfo.isEarlyAccess
        ? environment.stripePrices.early6Month
        : environment.stripePrices.public6Month,
      annual: this.accountInfo.isEarlyAccess
        ? environment.stripePrices.early12Month
        : environment.stripePrices.public12Month,
      lifetime: environment.stripePrices.earlyLifetime
    };

    const priceId = priceIdMap[tier];
    const isLifetime = tier === 'lifetime';

    const loading = await this.loadingController.create({
      message: 'Creating checkout session...',
      cssClass: 'custom-loading'
    });
    await loading.present();

    try {
      const request = new CreateCheckoutSessionRequest({
        priceId: priceId,
        isLifetime: isLifetime
      });

      const response = await lastValueFrom(this.apiService.createCheckoutSession(request));

      await loading.dismiss();

      if (response?.isSuccess && response.checkoutUrl) {
        // Open Stripe checkout in same window
        console.log('[AccountManagement] Redirecting to Stripe checkout:', response.checkoutUrl);
        console.log('[AccountManagement] Current auth state before redirect - check if persisted');
        window.location.href = response.checkoutUrl;

      } else {
        await this.showError(
          response?.errors?.[0]?.errorMessage ||
          'Failed to create checkout session. Please try again.'
        );
      }
    } catch (error) {
      await loading.dismiss();
      console.error('Error creating checkout session:', error);
      await this.showError('Failed to create checkout session. Please try again.');
    }
  }
}

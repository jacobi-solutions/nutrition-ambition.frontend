import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  IonContent,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonButton,
  IonSpinner,
  IonIcon
} from '@ionic/angular/standalone';
import { AppHeaderComponent } from 'src/app/components/header/header.component';
import { AccountsService } from 'src/app/services/accounts.service';
import { addIcons } from 'ionicons';
import { checkmarkCircle } from 'ionicons/icons';

@Component({
  selector: 'app-payment-success',
  templateUrl: './payment-success.page.html',
  styleUrls: ['./payment-success.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    AppHeaderComponent,
    IonContent,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonButton,
    IonSpinner,
    IonIcon
  ],
})
export class PaymentSuccessPage implements OnInit, OnDestroy {
  isProcessing = true;
  processingComplete = false;
  processingTimeout = false;
  pollAttempts = 0;
  maxPollAttempts = 15; // 15 attempts x 2 seconds = 30 seconds max
  pollInterval: any;

  constructor(
    private accountsService: AccountsService,
    private router: Router
  ) {
    addIcons({ checkmarkCircle });
  }

  async ngOnInit() {
    // Start polling for subscription status updates
    await this.startPolling();
  }

  ngOnDestroy() {
    this.stopPolling();
  }

  private async startPolling() {
    // Initial check
    await this.checkSubscriptionStatus();

    // Poll every 2 seconds
    this.pollInterval = setInterval(async () => {
      this.pollAttempts++;

      if (this.pollAttempts >= this.maxPollAttempts) {
        // Timeout after 30 seconds
        this.stopPolling();
        this.isProcessing = false;
        this.processingTimeout = true;
        return;
      }

      await this.checkSubscriptionStatus();
    }, 2000);
  }

  private stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  private async checkSubscriptionStatus() {
    try {
      await this.accountsService.loadAccount();
      const account = this.accountsService.currentAccount;

      // Check if subscription is now active
      if (account?.isPremium || account?.isPremiumLifetime) {
        this.stopPolling();
        this.isProcessing = false;
        this.processingComplete = true;

        // Auto-redirect after 2 seconds
        setTimeout(() => {
          this.navigateToAccount();
        }, 2000);
      }
    } catch (error) {
      console.error('Error checking subscription status:', error);
      // Continue polling even if there's an error
    }
  }

  navigateToAccount() {
    this.router.navigate(['/account-management']);
  }
}

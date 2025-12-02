import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Auth, signInWithCustomToken } from '@angular/fire/auth';
import { IonContent, IonSpinner, IonButton } from '@ionic/angular/standalone';
import { lastValueFrom } from 'rxjs';
import { NutritionAmbitionApiService, ValidateHandoffRequest } from 'src/app/services/nutrition-ambition-api.service';
import { AnalyticsService } from 'src/app/services/analytics.service';

@Component({
  selector: 'app-auth-handoff',
  templateUrl: './auth-handoff.page.html',
  styleUrls: ['./auth-handoff.page.scss'],
  standalone: true,
  imports: [CommonModule, IonContent, IonSpinner, IonButton]
})
export class AuthHandoffPage implements OnInit {
  private auth = inject(Auth);
  private router = inject(Router);
  private apiService = inject(NutritionAmbitionApiService);
  private analyticsService = inject(AnalyticsService);

  isProcessing = true;
  message = 'Signing you in...';
  errorMessage = '';
  showReturnToApp = false;
  debugInfo = '';  // Visible debug info for troubleshooting

  async ngOnInit() {
    // Track that page was loaded
    this.analyticsService.trackEvent('auth_handoff_loaded');

    // Capture debug info BEFORE any processing
    const fullUrl = window.location.href;
    const hash = window.location.hash;
    const hashLength = hash?.length || 0;

    // Build visible debug info
    this.debugInfo = `URL: ${fullUrl.substring(0, 60)}...\nHash length: ${hashLength}\nHas #token=: ${hash?.includes('#token=') || hash?.startsWith('token=')}`;

    // Also log to console
    console.log('[AuthHandoff] Page loaded');
    console.log('[AuthHandoff] Full URL:', fullUrl);
    console.log('[AuthHandoff] Hash:', hash);
    console.log('[AuthHandoff] Hash length:', hashLength);

    try {
      // Extract token from URL fragment (hash) instead of query params
      // Safari on iOS strips query params but never modifies the fragment
      const token = this.extractTokenFromHash();
      console.log('[AuthHandoff] Extracted token:', token ? `${token.substring(0, 50)}...` : 'null');

      // Update debug info with token status
      this.debugInfo += `\nToken extracted: ${token ? 'YES' : 'NO'}`;

      // Immediately clean URL to remove token from browser history
      this.cleanUrl();

      if (!token) {
        console.log('[AuthHandoff] No token found, showing error');
        await this.handleError('invalid', 'Missing authentication token');
        return;
      }

      // Decode JWT to extract claims (nonce, iat_custom, redirect)
      const claims = this.decodeJwtClaims(token);
      if (!claims || !claims.nonce || !claims.iat_custom) {
        await this.handleError('invalid', 'Invalid token format');
        return;
      }

      // Validate the handoff token with backend
      this.message = 'Verifying...';
      const validateRequest = new ValidateHandoffRequest({
        nonce: claims.nonce,
        issuedAt: claims.iat_custom,
        redirectPath: claims.redirect  // Send redirect from claims for server validation
      });

      const response = await lastValueFrom(this.apiService.validateHandoff(validateRequest));

      if (!response?.isValid) {
        const errorCode = response?.errorCode || 'invalid';
        let userMessage = 'We couldn\'t verify your account. Please return to the app and try again.';

        if (errorCode === 'expired') {
          userMessage = 'This login link has expired. Please return to the app and try again.';
        } else if (errorCode === 'already_used') {
          userMessage = 'This login link has already been used. Please return to the app and try again.';
        }

        await this.handleError(errorCode, userMessage);
        return;
      }

      // Sign in with the custom token
      this.message = 'Signing in...';
      await signInWithCustomToken(this.auth, token);

      // Track success
      this.analyticsService.trackEvent('auth_handoff_success');

      // Store source in sessionStorage so other pages can show "Return to App" button
      if (claims.source === 'app') {
        sessionStorage.setItem('authSource', 'app');
      }

      this.message = 'Success! Redirecting...';
      this.isProcessing = false;

      // Use server-provided redirect path (validated against whitelist)
      const redirect = response.redirectPath || '/account-management';

      // Small delay for user feedback, then redirect
      setTimeout(() => {
        this.router.navigateByUrl(redirect, { replaceUrl: true });
      }, 500);

    } catch (error: any) {
      console.error('Auth handoff failed:', error);

      // Provide user-friendly error messages
      let errorMessage = 'Authentication failed. Please return to the app and try again.';
      let errorCode = 'unknown';

      if (error?.code === 'auth/invalid-custom-token') {
        errorMessage = 'This login link is invalid or has expired. Please return to the app and try again.';
        errorCode = 'invalid_token';
      } else if (error?.code === 'auth/network-request-failed') {
        errorMessage = 'Network error. Please check your connection and try again.';
        errorCode = 'network';
      }

      await this.handleError(errorCode, errorMessage);
    }
  }

  private extractTokenFromHash(): string | null {
    // Extract token from URL fragment: /auth-handoff#token=XYZ
    const hash = window.location.hash;
    if (!hash || hash.length <= 1) {
      return null;
    }

    // Remove the leading '#' and parse as URL params
    const params = new URLSearchParams(hash.substring(1));
    return params.get('token');
  }

  private cleanUrl(): void {
    // Remove token from URL to prevent it from being visible in browser history
    const cleanUrl = window.location.pathname;
    window.history.replaceState({}, document.title, cleanUrl);
  }

  private decodeJwtClaims(token: string): { nonce?: string; iat_custom?: number; redirect?: string; source?: string } | null {
    try {
      // JWT is 3 parts separated by dots: header.payload.signature
      const parts = token.split('.');
      if (parts.length !== 3) {
        return null;
      }

      // Decode the payload (second part)
      const payload = parts[1];
      const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
      const claims = JSON.parse(decoded);

      // Note: "nonce" is a reserved Firebase claim, so backend uses "handoff_nonce"
      return {
        nonce: claims.claims?.handoff_nonce || claims.handoff_nonce,
        iat_custom: claims.claims?.iat_custom || claims.iat_custom,
        redirect: claims.claims?.redirect || claims.redirect,
        source: claims.claims?.source || claims.source
      };
    } catch (error) {
      console.error('Failed to decode JWT claims:', error);
      return null;
    }
  }

  private async handleError(errorCode: string, message: string): Promise<void> {
    this.isProcessing = false;
    this.errorMessage = message;
    this.message = '';

    // Track error
    this.analyticsService.trackEvent('auth_handoff_error', { errorCode });

    // Show return to app button after a short delay
    setTimeout(() => {
      this.showReturnToApp = true;
    }, 2000);
  }

  returnToApp(): void {
    // Deep link back to the app
    window.location.href = 'nutritionambition://';
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }
}

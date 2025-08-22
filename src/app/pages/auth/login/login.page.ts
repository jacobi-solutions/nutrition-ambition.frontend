import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { AuthService } from '../../../services/auth.service';
import { AnalyticsService } from '../../../services/analytics.service';
import { Router, RouterModule } from '@angular/router';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonGrid, IonRow, IonCol, IonItem, IonLabel, IonInput, IonButton, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonInputPasswordToggle } from '@ionic/angular/standalone';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,

      // Required standalone components
      IonContent,
      IonInput, IonButton, IonInputPasswordToggle
  ],
})
export class LoginPage implements OnInit, OnDestroy {
  email: string = '';
  password: string = '';
  isWorking: boolean = false;
  public notice: string | null = null;

  private authRequiredSub?: Subscription;
  private noticeSub?: Subscription;

  constructor(
    private authService: AuthService, 
    private router: Router,
    private analyticsService: AnalyticsService
  ) {}

  async ngOnInit(): Promise<void> {
    // Pull any one-time auth notice if present
    this.notice = this.authService.consumeAuthNotice();
    // If already authenticated, redirect out of login
    try {
      const isAuthed = await this.authService.isAuthenticated();
      const isAnon = this.authService.isAnonymous();
      if (isAuthed && !isAnon) {
        const target = this.authService.consumeLastAttemptedRoute('/app/chat');
        this.router.navigateByUrl(target);
        return;
      }
    } catch {}

    // Optional: react to future notices while on the page
    this.noticeSub = this.authService.authNotice$.subscribe(m => {
      this.notice = m;
    });
  }

  ngOnDestroy(): void {
    this.authRequiredSub?.unsubscribe();
    this.noticeSub?.unsubscribe();
  }
  async onForgotPassword() {
    if (!this.email) {
      this.notice = 'Please enter your email first.';
      return;
    }
    try {
      await this.authService.resetPassword(this.email);
      this.notice = 'We sent you a password reset link.';
    } catch {
      this.notice = 'Unable to send reset email. Please try again.';
    }
  } 

  async onLogin() {
    try {
      // Track login attempt
      this.analyticsService.trackActionClick('login_attempt', 'auth_page', { method: 'email' });
      
      await this.authService.signInWithEmail(this.email, this.password);
      
      // Track successful login
      this.analyticsService.trackAuthEvent('login');
      
      const target = this.authService.consumeLastAttemptedRoute('/app/chat');
      await this.router.navigateByUrl(target, { replaceUrl: true });
      setTimeout(() => location.reload(), 0);
    } catch (error) {
      console.error('Login failed:', error);
      // Track login failure
      this.analyticsService.trackEvent('login_failed', { method: 'email', error: error?.toString() || 'unknown' });
    }
  }

  navigateToChat() {
    this.router.navigate(['/app/chat']);
  }

  async onContinueAsGuest(): Promise<void> {
    if (this.isWorking) return;
    this.isWorking = true;
    try {
      // Track guest login attempt
      this.analyticsService.trackActionClick('guest_login_attempt', 'auth_page', { method: 'anonymous' });
      
      await this.authService.startAnonymousSession();
      
      // Track successful guest login
      this.analyticsService.trackAuthEvent('login');
      this.analyticsService.trackEvent('guest_login_success');
      
      const target = this.authService.consumeLastAttemptedRoute('/app/chat');
      await this.router.navigateByUrl(target);
    } catch (error) {
      if (environment.authDebug) {
        // eslint-disable-next-line no-console
        console.warn('Continue as Guest failed:', error);
      }
    } finally {
      this.isWorking = false;
    }
  }
}

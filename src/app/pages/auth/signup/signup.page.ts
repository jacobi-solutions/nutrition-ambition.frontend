import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { AuthService } from '../../../services/auth.service';
import { ToastService } from '../../../services/toast.service';
import { Router, RouterModule } from '@angular/router';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonGrid, IonRow, IonCol, IonItem, IonLabel, IonInput, IonButton, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonInputPasswordToggle } from '@ionic/angular/standalone';
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
    IonInput, IonButton, IonInputPasswordToggle
  ],
})
export class SignupPage {
  email: string = '';
  password: string = '';
  confirmPassword: string = '';
  isWorking: boolean = false;

  constructor(
    private authService: AuthService, 
    private router: Router,
    private toastService: ToastService
  ) {}

  async onSignup() {
    if (this.password !== this.confirmPassword) {
      console.error('Passwords do not match');
      return;
    }

    try {
      await this.authService.registerWithEmail(this.email, this.password);
      
      // Show success toast
      await this.toastService.showToast({
        message: 'Account created. You\'re all set!',
        color: 'success',
        duration: 3000
      });
      
      // Navigate to chat for consistency with login
      this.router.navigate(['/app/chat']);
    } catch (error) {
      console.error('Signup failed:', error);
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
      if (environment.authDebug) {
        // eslint-disable-next-line no-console
        console.warn('Continue as Guest failed:', error);
      }
    } finally {
      this.isWorking = false;
    }
  }
} 
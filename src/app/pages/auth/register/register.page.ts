import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { AuthService } from '../../../services/auth.service';
import { Router, RouterModule } from '@angular/router';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonGrid, IonRow, IonCol, IonItem, IonLabel, IonInput, IonButton, IonCard, IonCardHeader, IonCardTitle, IonCardContent } from '@ionic/angular/standalone';

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
  standalone: true,
  imports: [
    FormsModule,
    RouterModule,

    // Required standalone components
    IonTitle, IonContent,
    IonGrid, IonRow, IonCol,
    IonItem, IonLabel, IonInput, IonButton,
    IonCard, IonCardHeader, IonCardTitle, IonCardContent
  ],
})
export class RegisterPage {
  email: string = '';
  password: string = '';
  confirmPassword: string = '';

  constructor(private authService: AuthService, private router: Router) {}

  async onRegister() {
    if (this.password !== this.confirmPassword) {
      console.error('Passwords do not match');
      return;
    }

    try {
      await this.authService.registerWithEmail(this.email, this.password);
      this.router.navigate(['/home']);
    } catch (error) {
      console.error('Registration failed:', error);
    }
  }
} 
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  IonContent,
  IonCard,
  IonCardContent,
  IonButton,
  IonIcon
} from '@ionic/angular/standalone';
import { AppHeaderComponent } from 'src/app/components/header/header.component';
import { addIcons } from 'ionicons';
import { closeCircle } from 'ionicons/icons';

@Component({
  selector: 'app-payment-cancel',
  templateUrl: './payment-cancel.page.html',
  styleUrls: ['./payment-cancel.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    AppHeaderComponent,
    IonContent,
    IonCard,
    IonCardContent,
    IonButton,
    IonIcon
  ],
})
export class PaymentCancelPage {
  constructor(private router: Router) {
    addIcons({ closeCircle });
  }

  navigateToAccount() {
    this.router.navigate(['/account-management']);
  }
}

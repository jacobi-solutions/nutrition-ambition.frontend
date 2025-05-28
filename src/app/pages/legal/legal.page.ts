import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { 
  IonHeader, 
  IonToolbar, 
  IonTitle, 
  IonContent, 
  IonButtons, 
  IonBackButton,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-legal',
  templateUrl: './legal.page.html',
  styleUrls: ['./legal.page.scss'],
  standalone: true,
  imports: [
    RouterModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButtons,
    IonBackButton,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent
  ],
})
export class LegalPage {
  constructor() {}
} 
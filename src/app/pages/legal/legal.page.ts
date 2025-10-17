import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import {
  IonContent,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent
} from '@ionic/angular/standalone';
import { AppHeaderComponent } from 'src/app/components/header/header.component';

@Component({
  selector: 'app-legal',
  templateUrl: './legal.page.html',
  styleUrls: ['./legal.page.scss'],
  standalone: true,
  imports: [
    RouterModule,
    AppHeaderComponent,
    IonContent,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent
  ],
})
export class LegalPage {
  constructor() {}
} 
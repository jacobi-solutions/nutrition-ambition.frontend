import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import {
  IonContent
} from '@ionic/angular/standalone';
import { AppHeaderComponent } from 'src/app/components/header/header.component';

@Component({
  selector: 'app-terms-of-service',
  templateUrl: './terms-of-service.page.html',
  styleUrls: ['./terms-of-service.page.scss'],
  standalone: true,
  imports: [
    RouterModule,
    AppHeaderComponent,
    IonContent
  ],
})
export class TermsOfServicePage {
  constructor() {}
} 
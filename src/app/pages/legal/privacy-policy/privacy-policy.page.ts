import { Component } from '@angular/core';
import {
  IonContent
} from '@ionic/angular/standalone';
import { AppHeaderComponent } from 'src/app/components/header/header.component';

@Component({
  selector: 'app-privacy-policy',
  templateUrl: './privacy-policy.page.html',
  styleUrls: ['./privacy-policy.page.scss'],
  standalone: true,
  imports: [
    AppHeaderComponent,
    IonContent
  ],
})
export class PrivacyPolicyPage {
  constructor() {}
} 
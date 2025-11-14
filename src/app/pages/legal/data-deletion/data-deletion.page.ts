import { Component } from '@angular/core';
import {
  IonContent
} from '@ionic/angular/standalone';
import { AppHeaderComponent } from 'src/app/components/header/header.component';

@Component({
  selector: 'app-data-deletion',
  templateUrl: './data-deletion.page.html',
  styleUrls: ['./data-deletion.page.scss'],
  standalone: true,
  imports: [
    AppHeaderComponent,
    IonContent
  ],
})
export class DataDeletionPage {
  constructor() {}
}
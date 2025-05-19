import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterOutlet } from '@angular/router';
import { AccountsService } from './services/accounts.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule]
})
export class AppComponent implements OnInit {
  title = 'Nutrition Ambition';

  constructor(private accountsService: AccountsService) {}

  async ngOnInit() {
    console.log('[AppComponent] Initializing app');
    
    // Initialize anonymous account if needed
    // This ensures we only try to create an anonymous account once per app initialization
    await this.accountsService.initializeAnonymousAccount();
  }
}

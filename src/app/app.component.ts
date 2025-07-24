import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterOutlet } from '@angular/router';
import { AccountsService } from './services/accounts.service';
import { AuthService } from './services/auth.service';
import { filter, take } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule]
})
export class AppComponent implements OnInit {
  title = 'Nutrition Ambition';

  constructor(
    private accountsService: AccountsService,
    private authService: AuthService
  ) {}

  async ngOnInit() {
    console.log('[AppComponent] Initializing app');
    
    // Wait for auth to be ready, then load account info
    this.authService.authReady$.pipe(
      filter(ready => ready), // Wait until Firebase Auth is initialized
      take(1) // Only take the first ready event
    ).subscribe(async () => {
      console.log('[AppComponent] Auth is ready, loading account...');
      
      // Check if user is authenticated before loading account
      const isAuthenticated = await this.authService.isAuthenticated();
      if (isAuthenticated) {
        await this.accountsService.loadAccount();
      } else {
        console.log('[AppComponent] User not authenticated, skipping account load');
      }
    });
  }
}

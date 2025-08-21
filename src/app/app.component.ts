import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterOutlet } from '@angular/router';
import { AccountsService } from './services/accounts.service';
import { AuthService } from './services/auth.service';
import { AnalyticsService } from './services/analytics.service';
import { take } from 'rxjs';
import { environment } from 'src/environments/environment';
import { SwUpdate } from '@angular/service-worker';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule]
})
export class AppComponent implements OnInit {
  title = 'Nutrition Ambition';

  private authService = inject(AuthService);
  private analyticsService = inject(AnalyticsService);

  constructor(
    private accountsService: AccountsService,
    private swUpdate: SwUpdate
  ) {}
  
  async ngOnInit() {
    // 🔹 Track PWA standalone mode usage
    this.trackStandaloneModeIfApplicable();

    // 🔹 Service Worker Update Check
    if (this.swUpdate.isEnabled) {
      try {
        await this.swUpdate.checkForUpdate();
      } catch (err) {
        console.warn('SW update check failed:', err);
      }
  
      this.swUpdate.versionUpdates.subscribe(event => {
        if (event.type === 'VERSION_READY') {
          console.log('🚀 New version available. Reloading...');
          document.location.reload();
        }
      });
    }
  
    // 🔹 Auth / Accounts init
    this.authService.authReady$.pipe(take(1)).subscribe({
      next: async () => {
        try {
          const isAuthenticated = await this.authService.isAuthenticated();
          if (isAuthenticated) {
            await this.accountsService.loadAccount();
          }
        } catch (e) {
          console.warn('[App] init error', e);
        }
      }
    });
  }

  private trackStandaloneModeIfApplicable() {
    // Check if app is running in standalone mode (PWA)
    const isStandalone = 
      ('standalone' in navigator && (navigator as any).standalone) || // iOS Safari
      window.matchMedia('(display-mode: standalone)').matches; // Modern browsers
    
    if (isStandalone) {
      this.analyticsService.trackPwaStandaloneMode();
    }
  }
  
}

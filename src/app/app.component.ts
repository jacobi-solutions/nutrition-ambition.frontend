import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterOutlet } from '@angular/router';
import { AccountsService } from './services/accounts.service';
import { AuthService } from './services/auth.service';
import { AnalyticsService } from './services/analytics.service';
import { AppUpdateService } from './services/app-update.service';
import { take } from 'rxjs';
import { environment } from 'src/environments/environment';

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
  private appUpdateService = inject(AppUpdateService);

  constructor(
    private accountsService: AccountsService
  ) {}
  
    async ngOnInit() {
    // 🔹 Track PWA standalone mode usage
    this.trackStandaloneModeIfApplicable();

    // 🔹 Initialize app update service
    this.appUpdateService.initAutoUpdateListeners();

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

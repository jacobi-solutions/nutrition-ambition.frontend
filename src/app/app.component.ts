import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterOutlet } from '@angular/router';
import { AccountsService } from './services/accounts.service';
import { AuthService } from './services/auth.service';
import { AnalyticsService } from './services/analytics.service';
import { take } from 'rxjs';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule]
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'Nutrition Ambition';

  private authService = inject(AuthService);
  private analyticsService = inject(AnalyticsService);

  // Safari bfcache workaround handler - stored as property for cleanup
  private pageShowHandler = (event: PageTransitionEvent) => {
    if (event.persisted) {
      window.location.reload();
    }
  };

  constructor(
    private accountsService: AccountsService
  ) {}

  async ngOnInit() {
    // Safari bfcache workaround: detect when page is restored from back-forward cache
    // and force a reload to ensure Angular properly initializes (fixes blank page on iOS
    // Safari after returning from external sites like Stripe checkout)
    window.addEventListener('pageshow', this.pageShowHandler);

    // 🔹 Auth / Accounts init
    this.authService.authReady$.pipe(take(1)).subscribe({
      next: async () => {
        try {
          const isAuthenticated = await this.authService.isAuthenticated();
          if (isAuthenticated) {
            await this.accountsService.loadAccount();
          }
        } catch (e) {
          // Auth/account initialization failures are non-fatal at startup
        }
      }
    });
  }

  ngOnDestroy() {
    window.removeEventListener('pageshow', this.pageShowHandler);
  }
}

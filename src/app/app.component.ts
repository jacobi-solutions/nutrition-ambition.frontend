import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterOutlet } from '@angular/router';
import { AccountsService } from './services/accounts.service';
import { AuthService } from './services/auth.service';
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

  constructor(
    private accountsService: AccountsService
  ) {}

  async ngOnInit() {
    // After auth is ready, only load account if authenticated. Do not start anonymous sessions here.
    this.authService.authReady$.pipe(take(1)).subscribe({
      next: async () => {
        try {
          // Only load account data if a user is present (anon or registered)
          const isAuthenticated = await this.authService.isAuthenticated();
          if (isAuthenticated) {
            await this.accountsService.loadAccount();
          }
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn('[App] init error', e);
        }
      }
    });
  }
}

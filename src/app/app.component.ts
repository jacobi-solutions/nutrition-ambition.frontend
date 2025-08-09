import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterOutlet } from '@angular/router';
import { AccountsService } from './services/accounts.service';
import { AuthService } from './services/auth.service';
import { take } from 'rxjs';

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
    // After auth is ready, ensure an anonymous session exists exactly once if needed
    this.authService.authReady$.pipe(take(1)).subscribe({
      next: async () => {
        try {
          const currentUser = (this.authService as any)['authInstance']?.currentUser;
          if (!currentUser) {
            if ((window as any).environment?.authDebug) {
              // eslint-disable-next-line no-console
              console.debug('[Auth] No user at ready → starting anonymous session');
            }
            await this.authService.ensureAnonymousSession();
          } else if ((window as any).environment?.authDebug) {
            // eslint-disable-next-line no-console
            console.debug('[Auth] Existing user at ready:', { uid: currentUser.uid, anon: currentUser.isAnonymous });
          }

          // Existing behavior: attempt to load account if authenticated
          const isAuthenticated = await this.authService.isAuthenticated();
          if (isAuthenticated) {
            await this.accountsService.loadAccount();
          }
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn('[Auth] ensureAnonymousSession error', e);
        }
      }
    });
  }
}

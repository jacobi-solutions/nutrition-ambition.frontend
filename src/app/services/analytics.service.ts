import { Injectable, inject } from '@angular/core';
import { Analytics, logEvent, setUserId } from '@angular/fire/analytics';
import { Auth } from '@angular/fire/auth';

@Injectable({
  providedIn: 'root',
})
export class AnalyticsService {
  private analytics = inject(Analytics);
  private auth = inject(Auth);

  constructor() {
    // Whenever auth state changes, set the userId in analytics
    this.auth.onAuthStateChanged(user => {
      if (user) {
        setUserId(this.analytics, user.uid);
      } else {
        setUserId(this.analytics, null);
      }
    });
  }

  /** Track page/screen views (manual, in addition to ScreenTrackingService auto-logging) */
  trackPageView(pageName: string) {
    logEvent(this.analytics, 'screen_view' as any, { pageName });
  }

  /** Track when a chat message is sent */
  trackChatMessageSent(messageLength: number) {
    logEvent(this.analytics, 'chat_message_sent' as any, { messageLength });
  }

  /** Track when a food entry is added */
  trackFoodEntryAdded(entryId: string, mealName: string) {
    logEvent(this.analytics, 'food_entry_added' as any, { entryId, mealName });
  }

  /** Track auth login/logout */
  trackAuthEvent(type: 'login' | 'logout') {
    logEvent(this.analytics, `auth_${type}` as any);
  }

  /** Track PWA installation attempts */
  trackPwaInstallAttempted(platform: string, method: 'prompt' | 'manual') {
    logEvent(this.analytics, 'pwa_install_attempted' as any, { platform, method });
  }

  /** Track successful PWA installations */
  trackPwaInstallCompleted(platform: string, method: 'prompt' | 'manual') {
    logEvent(this.analytics, 'pwa_install_completed' as any, { platform, method });
  }

  /** Track when PWA installation is cancelled */
  trackPwaInstallCancelled(platform: string, method: 'prompt' | 'manual') {
    logEvent(this.analytics, 'pwa_install_cancelled' as any, { platform, method });
  }

  /** Track when app is opened in standalone mode (PWA) */
  trackPwaStandaloneMode() {
    logEvent(this.analytics, 'pwa_standalone_mode' as any);
  }

  /** Generic tracker for anything else */
  trackEvent(eventName: string, params?: Record<string, any>) {
    logEvent(this.analytics, eventName as any, params || {});
  }
}

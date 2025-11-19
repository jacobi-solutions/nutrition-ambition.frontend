import { Injectable, inject, Injector, runInInjectionContext } from '@angular/core';
import { Analytics, logEvent, setUserId } from '@angular/fire/analytics';
import { Auth } from '@angular/fire/auth';

@Injectable({
  providedIn: 'root',
})
export class AnalyticsService {
  private analytics = inject(Analytics);
  private auth = inject(Auth);
  private injector = inject(Injector);

  constructor() {
    // Whenever auth state changes, set the userId in analytics
    this.auth.onAuthStateChanged(user => {
      runInInjectionContext(this.injector, () => {
        if (user) {
          setUserId(this.analytics, user.uid);
        } else {
          setUserId(this.analytics, null);
        }
      });
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

  /** Track entry action menu interactions */
  trackEntryAction(action: string, entryType: string, isImplemented: boolean, entryId?: string) {
    logEvent(this.analytics, 'entry_action_selected' as any, { 
      action, 
      entryType, 
      isImplemented,
      entryId: entryId || 'unknown'
    });
  }

  /** Track FAB (floating action button) interactions */
  trackFabAction(action: string, isImplemented: boolean) {
    logEvent(this.analytics, 'fab_action_selected' as any, { 
      action, 
      isImplemented 
    });
  }

  /** Track FAB toggle (open/close) */
  trackFabToggle(isOpen: boolean) {
    logEvent(this.analytics, 'fab_toggled' as any, { isOpen });
  }

  /** Track unimplemented feature interactions */
  trackUnimplementedFeature(featureType: 'entry_action' | 'fab_action' | 'other', featureName: string, context?: string) {
    logEvent(this.analytics, 'unimplemented_feature_clicked' as any, { 
      featureType, 
      featureName,
      context: context || 'unknown'
    });
  }

  /** Track button/action clicks with context */
  trackActionClick(actionName: string, context: string, additionalData?: Record<string, any>) {
    logEvent(this.analytics, 'action_click' as any, { 
      actionName, 
      context,
      ...additionalData 
    });
  }

  /** Generic tracker for anything else */
  trackEvent(eventName: string, params?: Record<string, any>) {
    logEvent(this.analytics, eventName as any, params || {});
  }
}

import { Injectable, inject } from '@angular/core';
import { AnalyticsService } from './analytics.service';

export enum InstallMode {
  AndroidPrompt,     // Android + Chrome/Edge/Brave → has beforeinstallprompt
  AndroidManual,     // Android, but no prompt (e.g., Firefox, Samsung browser)
  IosSafari,         // Safari on iOS
  IosOther,          // Chrome/Firefox/etc. on iOS (manual but may be limited)
  Unsupported        // Desktop or unknown
}

@Injectable({ providedIn: 'root' })
export class PwaInstallService {
  private deferredPrompt: any = null;
  private analytics = inject(AnalyticsService);

  constructor() {
    // Capture install prompt event on Android Chrome/Edge
    window.addEventListener('beforeinstallprompt', (event: Event) => {
      event.preventDefault();
      this.deferredPrompt = event;
    });

    // Listen for successful app installation
    window.addEventListener('appinstalled', (event: Event) => {
      const platform = this.getPlatformName();
      const method = this.deferredPrompt ? 'prompt' : 'manual';
      this.analytics.trackPwaInstallCompleted(platform, method);
    });
  }

  /** Detect whether the app is already installed */
  isInstalled(): boolean {
    // iOS Safari standalone
    if ('standalone' in navigator && (navigator as any).standalone) {
      return true;
    }
    // Android/Chrome standalone (and most modern browsers)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      return true;
    }
    return false;
  }

  /** Decide which install mode applies for this device/browser */
  getInstallMode(): InstallMode {
    if (this.isInstalled()) return InstallMode.Unsupported;

    const ua = navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(ua);
    const isSafari = isIOS && /^((?!crios|fxios|edgios).)*safari/.test(ua);
    const isAndroid = /android/.test(ua);

    if (isAndroid && this.deferredPrompt) return InstallMode.AndroidPrompt;
    if (isAndroid) return InstallMode.AndroidManual;
    if (isSafari) return InstallMode.IosSafari;
    if (isIOS) return InstallMode.IosOther;
    return InstallMode.Unsupported;
  }

  /** True if user *could* install (manually or via prompt) */
  canInstall(): boolean {
    const mode = this.getInstallMode();
    return mode !== InstallMode.Unsupported && !this.isInstalled();
  }

  /** Get platform name for analytics */
  private getPlatformName(): string {
    const ua = navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(ua);
    const isAndroid = /android/.test(ua);
    const isSafari = isIOS && /^((?!crios|fxios|edgios).)*safari/.test(ua);
    
    if (isAndroid) return 'Android';
    if (isSafari) return 'iOS Safari';
    if (isIOS) return 'iOS Other';
    return 'Desktop/Other';
  }

  /** Trigger install prompt or return proper message for manual flow */
  async install(): Promise<{ outcome?: string; message?: string }> {
    const mode = this.getInstallMode();
    const platform = this.getPlatformName();

    switch (mode) {
      case InstallMode.AndroidPrompt:
        if (!this.deferredPrompt) {
          return { message: 'Install prompt unavailable.' };
        }
        
        // Track install attempt
        this.analytics.trackPwaInstallAttempted(platform, 'prompt');
        
        this.deferredPrompt.prompt();
        const choiceResult = await this.deferredPrompt.userChoice;
        this.deferredPrompt = null;
        
        // Track outcome
        if (choiceResult.outcome === 'dismissed') {
          this.analytics.trackPwaInstallCancelled(platform, 'prompt');
        }
        // Note: 'accepted' outcome will be tracked by appinstalled event
        
        return { outcome: choiceResult.outcome };

      case InstallMode.AndroidManual:
        this.analytics.trackPwaInstallAttempted(platform, 'manual');
        return { message: "On Android, open your browser menu → 'Add to Home Screen'." };

      case InstallMode.IosSafari:
        this.analytics.trackPwaInstallAttempted(platform, 'manual');
        return { message: "On Safari, tap the Share button → 'Add to Home Screen'." };

      case InstallMode.IosOther:
        this.analytics.trackPwaInstallAttempted(platform, 'manual');
        return { message: "On iOS, tap Share → 'Add to Home Screen'.\n\nIf you don't see that option, some versions of iOS only allow this in Safari — please open this app in Safari to complete install. Don't worry, it's a one-time step." };

      default:
        return { message: "Installing is only available on supported mobile browsers." };
    }
  }

  /** Get a friendly message up front (for popovers) */
  getInstallMessage(): string {
    const mode = this.getInstallMode();

    switch (mode) {
      case InstallMode.AndroidPrompt:
        return ''; // Chrome will show native prompt
      case InstallMode.AndroidManual:
        return "On Android, open your browser menu → 'Add to Home Screen'.";
      case InstallMode.IosSafari:
        return "On Safari, tap the Share button → 'Add to Home Screen'.";
      case InstallMode.IosOther:
        return "On iOS, tap Share → 'Add to Home Screen'.\n\nIf you don't see that option, some versions of iOS only allow it in Safari — please open this app in Safari to complete install. Don't worry, it's a one-time step.";
      default:
        return '';
    }
  }
}

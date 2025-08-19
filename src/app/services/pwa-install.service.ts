import { Injectable } from '@angular/core';

export enum InstallMode {
  AndroidPrompt,     // Android, Chrome/Edge/Brave → has beforeinstallprompt
  AndroidManual,     // Android, but no prompt (e.g., Firefox, Samsung browser)
  IosSafari,         // Safari on iOS
  IosOther,          // Chrome/Firefox/etc on iOS (can’t install directly)
  Unsupported        // Desktop or unknown
}

@Injectable({ providedIn: 'root' })
export class PwaInstallService {
  private deferredPrompt: any = null;

  constructor() {
    // Capture install prompt event on Android Chrome/Edge
    window.addEventListener('beforeinstallprompt', (event: Event) => {
      event.preventDefault();
      this.deferredPrompt = event;
    });
  }

  /** Detect whether the app is already installed */
  isInstalled(): boolean {
    // iOS Safari standalone
    if ('standalone' in navigator && (navigator as any).standalone) {
      return true;
    }
    // Android/Chrome standalone
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

  /** Trigger install prompt or return proper message for manual flow */
  async install(): Promise<{ outcome?: string; message?: string }> {
    const mode = this.getInstallMode();

    switch (mode) {
      case InstallMode.AndroidPrompt:
        if (!this.deferredPrompt) return { message: 'Install prompt unavailable.' };
        this.deferredPrompt.prompt();
        const choiceResult = await this.deferredPrompt.userChoice;
        this.deferredPrompt = null;
        return { outcome: choiceResult.outcome };

      case InstallMode.AndroidManual:
        return { message: "On Android, open your browser menu → 'Add to Home Screen'." };

      case InstallMode.IosSafari:
        return { message: "On Safari, tap the Share button → 'Add to Home Screen'." };

      case InstallMode.IosOther:
        return { message: "Please open this app in Safari on iOS to install. Don’t worry, it’s a one-time step." };

      default:
        return { message: "Installing is only available on mobile devices." };
    }
  }
}

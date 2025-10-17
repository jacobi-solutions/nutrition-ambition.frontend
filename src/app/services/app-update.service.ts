import { Injectable, NgZone, inject } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';

@Injectable({
  providedIn: 'root'
})
export class AppUpdateService {
  private swUpdate = inject(SwUpdate);
  private ngZone = inject(NgZone);

  private _reloading = false;
  private _hasBC = typeof BroadcastChannel !== 'undefined';
  private _bc: BroadcastChannel | null = this._hasBC ? new BroadcastChannel('na-sw-updates') : null;
  private _storageKey = 'na-sw-reload';

  initAutoUpdateListeners(): void {
    console.log('🔄 AppUpdateService: Initializing auto-update listeners');
    console.log('🔄 Service Worker enabled:', this.swUpdate.isEnabled);

    if (!this.swUpdate.isEnabled) {
      console.log('⚠️ Service Worker is NOT enabled - skipping update listeners');
      return;
    }

    // Listen for Angular SW version events
    this.swUpdate.versionUpdates.subscribe(async (event) => {
      console.log('🔄 SW Version Event:', event);
      if (event.type === 'VERSION_READY') {
        console.log('✅ New version ready! Activating and reloading...');
        if (this._reloading) return;
        this._reloading = true;
        try { await this.swUpdate.activateUpdate(); } catch (e) {
          console.error('🔴 Error activating update:', e);
        }
        this.broadcastReload();
        location.reload();
      }
    });

    // Cross-tab reload listeners
    if (this._bc) {
      this._bc.onmessage = (e) => {
        if (e?.data === 'reload-all' && !this._reloading) {
          this._reloading = true;
          location.reload();
        }
      };
      window.addEventListener('beforeunload', () => this._bc?.close?.());
    } else {
      window.addEventListener('storage', (e) => {
        if (e.key === this._storageKey && !this._reloading) {
          this._reloading = true;
          location.reload();
        }
      });
    }

    // Initial + lifecycle checks
    console.log('🔄 Running initial update check...');
    this.checkNow();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        console.log('🔄 Page visible - checking for updates...');
        this.checkNow();
      }
    });
    window.addEventListener('focus', () => {
      console.log('🔄 Window focused - checking for updates...');
      this.checkNow();
    });
    setInterval(() => {
      console.log('🔄 Periodic check (15min) - checking for updates...');
      this.checkNow();
    }, 15 * 60 * 1000);

  }

  async forceReloadToLatest(): Promise<void> {
    if (!this.swUpdate.isEnabled) {
      location.reload();
      return;
    }
    await this.checkNow(true);
  }

  private async checkNow(force = false): Promise<void> {
    if (this._reloading) return;
    try {
      console.log('🔍 checkNow called (force=' + force + ')');

      // Nudge browser SW check cadence
      const regs = await navigator.serviceWorker?.getRegistrations?.();
      console.log('🔍 Service Worker registrations:', regs?.length || 0);
      if (regs?.length) {
        await Promise.all(regs.map(r => r.update().catch(e => {
          console.error('🔴 Error updating SW registration:', e);
        })));
      }

      const hadUpdate = await this.swUpdate.checkForUpdate().catch((e) => {
        console.error('🔴 Error checking for update:', e);
        return false;
      });
      console.log('🔍 Update available:', hadUpdate);

      if (force) {
        console.log('🔄 Force reload requested - activating and reloading...');
        try { await this.swUpdate.activateUpdate(); } catch (e) {
          console.error('🔴 Error activating update:', e);
        }
        this._reloading = true;
        this.broadcastReload();
        location.reload();
      }
    } catch (e) {
      console.error('🔴 Error in checkNow:', e);
    }
  }

  private broadcastReload(): void {
    if (this._hasBC && this._bc) {
      try { this._bc.postMessage('reload-all'); } catch {}
    } else {
      try { localStorage.setItem(this._storageKey, Date.now().toString()); } catch {}
    }
  }
}

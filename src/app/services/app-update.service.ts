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
    if (!this.swUpdate.isEnabled) {
      console.log('[AppUpdate] SW not enabled');
      return;
    }

    // Listen for Angular SW version events
    this.swUpdate.versionUpdates.subscribe(async (event) => {
      if (event.type === 'VERSION_READY') {
        if (this._reloading) return;
        console.log('[AppUpdate] VERSION_READY → activating & reloading');
        this._reloading = true;
        try { await this.swUpdate.activateUpdate(); } catch (e) { console.warn('[AppUpdate] activateUpdate failed', e); }
        this.broadcastReload();
        location.reload();
      }
    });

    // Cross-tab reload listeners
    if (this._bc) {
      this._bc.onmessage = (e) => {
        if (e?.data === 'reload-all' && !this._reloading) {
          console.log('[AppUpdate] BC reload signal');
          this._reloading = true;
          location.reload();
        }
      };
      window.addEventListener('beforeunload', () => this._bc?.close?.());
    } else {
      window.addEventListener('storage', (e) => {
        if (e.key === this._storageKey && !this._reloading) {
          console.log('[AppUpdate] storage reload signal');
          this._reloading = true;
          location.reload();
        }
      });
    }

    // Initial + lifecycle checks
    this.checkNow();
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') this.checkNow(); });
    window.addEventListener('focus', () => this.checkNow());
    setInterval(() => this.checkNow(), 15 * 60 * 1000);

    console.log('[AppUpdate] Auto-update listeners initialized');
  }

  async forceReloadToLatest(): Promise<void> {
    console.log('[AppUpdate] Force reload requested');
    if (!this.swUpdate.isEnabled) {
      location.reload();
      return;
    }
    await this.checkNow(true);
  }

  private async checkNow(force = false): Promise<void> {
    if (this._reloading) return;
    try {
      // Nudge browser SW check cadence
      const regs = await navigator.serviceWorker?.getRegistrations?.();
      if (regs?.length) {
        await Promise.all(regs.map(r => r.update().catch(e => console.warn('[AppUpdate] SW reg update failed', e))));
      }

      const hadUpdate = await this.swUpdate.checkForUpdate().catch((e) => {
        console.warn('[AppUpdate] checkForUpdate error', e);
        return false;
      });
      console.log('[AppUpdate] checkForUpdate:', hadUpdate);

      if (force) {
        console.log('[AppUpdate] Forcing activation & reload');
        try { await this.swUpdate.activateUpdate(); } catch (e) { console.warn('[AppUpdate] force activate failed', e); }
        this._reloading = true;
        this.broadcastReload();
        location.reload();
      }
    } catch (e) {
      console.warn('[AppUpdate] checkNow failed', e);
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

import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';

/**
 * Service for platform detection across web and native (iOS/Android) environments.
 * Wraps Capacitor's Platform API for consistency with Angular DI patterns.
 */
@Injectable({
  providedIn: 'root'
})
export class PlatformService {

  constructor() { }

  /**
   * Check if running on a native platform (iOS or Android)
   */
  isNative(): boolean {
    return Capacitor.isNativePlatform();
  }

  /**
   * Check if running on web platform
   */
  isWeb(): boolean {
    return !Capacitor.isNativePlatform();
  }

  /**
   * Get the current platform name
   */
  getPlatform(): 'ios' | 'android' | 'web' {
    return Capacitor.getPlatform() as 'ios' | 'android' | 'web';
  }
}

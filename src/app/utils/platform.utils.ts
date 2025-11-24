import { Capacitor } from '@capacitor/core';

/**
 * Determines if the app is running in a native environment (iOS/Android).
 * Returns true for native apps, false for web/PWA.
 */
export const isNativePlatform = (): boolean => {
  return Capacitor.isNativePlatform();
};

/**
 * Gets the current platform name.
 * Returns 'ios', 'android', or 'web'.
 */
export const getPlatform = (): string => {
  return Capacitor.getPlatform();
};

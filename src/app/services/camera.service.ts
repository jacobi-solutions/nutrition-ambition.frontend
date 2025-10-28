import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { BarcodeWebService } from './barcode-web.service';
import { BarcodeNativeService } from './barcode-native.service';

/**
 * Core camera service that detects platform and delegates to appropriate implementation
 */
@Injectable({
  providedIn: 'root'
})
export class CameraService {
  private implementation: BarcodeWebService | BarcodeNativeService;

  constructor(
    private webService: BarcodeWebService,
    private nativeService: BarcodeNativeService
  ) {
    // Detect platform and choose implementation
    const platform = Capacitor.getPlatform();
    this.implementation = (platform === 'web') ? this.webService : this.nativeService;

    console.log(`[CameraService] Platform detected: ${platform}, using ${platform === 'web' ? 'html5-qrcode' : 'MLKit'}`);
  }

  /**
   * Scan a barcode using the appropriate platform implementation
   * @returns Promise with the scanned barcode string, or null if cancelled/failed
   */
  async scanBarcode(): Promise<string | null> {
    return this.implementation.scanBarcode();
  }

  /**
   * Check if camera permission is granted
   */
  async checkPermission(): Promise<boolean> {
    return this.implementation.checkPermission();
  }

  /**
   * Request camera permission
   */
  async requestPermission(): Promise<boolean> {
    return this.implementation.requestPermission();
  }
}

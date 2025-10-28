import { Injectable } from '@angular/core';
import { BarcodeScanner, BarcodeFormat } from '@capacitor-mlkit/barcode-scanning';

/**
 * Native implementation of barcode scanning using MLKit
 * Used for iOS and Android apps
 */
@Injectable({
  providedIn: 'root'
})
export class BarcodeNativeService {

  /**
   * Scan barcode using MLKit native camera
   */
  async scanBarcode(): Promise<string | null> {
    try {
      // Check permission first
      const hasPermission = await this.requestPermission();
      if (!hasPermission) {
        console.warn('[BarcodeNativeService] Camera permission denied');
        return null;
      }

      // Scan barcode
      const result = await BarcodeScanner.scan({
        formats: [
          BarcodeFormat.Ean13,
          BarcodeFormat.Ean8,
          BarcodeFormat.UpcA,
          BarcodeFormat.UpcE,
          BarcodeFormat.Code128,
          BarcodeFormat.Code39,
          BarcodeFormat.Code93,
          BarcodeFormat.Codabar,
          BarcodeFormat.Itf
        ]
      });

      if (result.barcodes && result.barcodes.length > 0) {
        const barcode = result.barcodes[0].rawValue;
        console.log('[BarcodeNativeService] Barcode scanned:', barcode);
        return barcode;
      }

      console.warn('[BarcodeNativeService] No barcode found');
      return null;
    } catch (error) {
      console.error('[BarcodeNativeService] Error scanning barcode:', error);
      return null;
    }
  }

  /**
   * Check if camera permission is granted
   */
  async checkPermission(): Promise<boolean> {
    try {
      const { camera } = await BarcodeScanner.checkPermissions();
      return camera === 'granted';
    } catch (error) {
      console.error('[BarcodeNativeService] Error checking permissions:', error);
      return false;
    }
  }

  /**
   * Request camera permission
   */
  async requestPermission(): Promise<boolean> {
    try {
      const { camera } = await BarcodeScanner.requestPermissions();
      return camera === 'granted';
    } catch (error) {
      console.error('[BarcodeNativeService] Error requesting permissions:', error);
      return false;
    }
  }
}

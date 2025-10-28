import { Injectable } from '@angular/core';
import { ModalController } from '@ionic/angular/standalone';
import { BarcodeScannerModalComponent } from '../components/barcode-scanner-modal/barcode-scanner-modal.component';

/**
 * Web implementation of barcode scanning using html5-qrcode library
 * Used for PWA and browser testing
 */
@Injectable({
  providedIn: 'root'
})
export class BarcodeWebService {
  private isScanning = false;

  constructor(private modalController: ModalController) {}

  /**
   * Scan barcode using html5-qrcode in browser
   * Opens a modal with camera view and cancel button
   */
  async scanBarcode(): Promise<string | null> {
    if (this.isScanning) {
      console.warn('[BarcodeWebService] Scan already in progress');
      return null;
    }

    try {
      this.isScanning = true;

      // Check permission first
      const hasPermission = await this.requestPermission();
      if (!hasPermission) {
        console.warn('[BarcodeWebService] Camera permission denied');
        return null;
      }

      // Open modal with scanner
      const modal = await this.modalController.create({
        component: BarcodeScannerModalComponent,
        cssClass: 'barcode-scanner-modal'
      });

      await modal.present();

      // Wait for modal to be dismissed (either by scan success or cancel)
      const { data } = await modal.onWillDismiss();

      // data will be the scanned barcode string, or null if cancelled
      return data || null;
    } catch (error) {
      console.error('[BarcodeWebService] Error during barcode scan:', error);
      return null;
    } finally {
      this.isScanning = false;
    }
  }

  /**
   * Check if camera permission is granted
   */
  async checkPermission(): Promise<boolean> {
    try {
      const result = await navigator.permissions.query({ name: 'camera' as PermissionName });
      return result.state === 'granted';
    } catch {
      // Permissions API not supported, assume we need to request
      return false;
    }
  }

  /**
   * Request camera permission
   */
  async requestPermission(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      // Permission granted, stop the stream immediately
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (error) {
      console.error('[BarcodeWebService] Camera permission denied:', error);
      return false;
    }
  }
}

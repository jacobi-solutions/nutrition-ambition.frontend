import { Component, OnInit, OnDestroy } from '@angular/core';
import { ModalController } from '@ionic/angular/standalone';
import { IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon, IonContent } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { close } from 'ionicons/icons';
import { Html5Qrcode } from 'html5-qrcode';

/**
 * Modal component for web-based barcode scanning
 * Displays camera view with cancel button
 */
@Component({
  selector: 'app-barcode-scanner-modal',
  templateUrl: './barcode-scanner-modal.component.html',
  styleUrls: ['./barcode-scanner-modal.component.scss'],
  standalone: true,
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonIcon,
    IonContent
  ]
})
export class BarcodeScannerModalComponent implements OnInit, OnDestroy {
  private scanner: Html5Qrcode | null = null;
  private scannerId = 'barcode-scanner-reader';

  constructor(private modalController: ModalController) {
    addIcons({ close });
  }

  async ngOnInit() {
    // Wait for view to initialize before starting scanner
    setTimeout(() => {
      this.startScanner();
    }, 100);
  }

  async ngOnDestroy() {
    await this.stopScanner();
  }

  /**
   * Start the barcode scanner
   */
  private async startScanner(): Promise<void> {
    try {
      this.scanner = new Html5Qrcode(this.scannerId);

      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
      };

      await this.scanner.start(
        { facingMode: 'environment' }, // Use back camera
        config,
        (decodedText) => {
          // Success - barcode scanned
          console.log('[BarcodeScannerModal] Barcode scanned:', decodedText);
          this.dismiss(decodedText);
        },
        (errorMessage) => {
          // Error callback - typically just "no barcode found" during scanning
          // We don't log these as they're expected during continuous scanning
        }
      );
    } catch (error) {
      console.error('[BarcodeScannerModal] Failed to start scanner:', error);
      this.dismiss(null);
    }
  }

  /**
   * Stop the scanner and clean up
   */
  private async stopScanner(): Promise<void> {
    if (this.scanner) {
      try {
        await this.scanner.stop();
        this.scanner.clear();
      } catch (error) {
        console.error('[BarcodeScannerModal] Error stopping scanner:', error);
      }
      this.scanner = null;
    }
  }

  /**
   * Cancel button clicked - dismiss without result
   */
  async cancel(): Promise<void> {
    await this.dismiss(null);
  }

  /**
   * Dismiss the modal with optional barcode result
   */
  private async dismiss(barcode: string | null): Promise<void> {
    await this.stopScanner();
    await this.modalController.dismiss(barcode);
  }
}

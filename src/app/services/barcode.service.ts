import { Injectable } from '@angular/core';
import { CameraService } from './camera.service';
import { BarcodeSearchRequest, SearchFoodPhraseResponse } from './nutrition-ambition-api.service';
import { ToastService } from './toast.service';
import { AnalyticsService } from './analytics.service';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { ChatStreamService } from './chat-stream.service';

/**
 * Business logic service for barcode scanning
 * Coordinates camera scanning and backend API calls
 */
@Injectable({
  providedIn: 'root'
})
export class BarcodeService {

  constructor(
    private cameraService: CameraService,
    private chatStreamService: ChatStreamService,
    private toastService: ToastService,
    private analyticsService: AnalyticsService
  ) {}

  /**
   * Scan a barcode and stream food information back
   * @param messageId - The message ID to append foods to
   * @param onChunk - Callback for each chunk of food data
   * @param onComplete - Callback when streaming completes
   * @param onError - Callback for errors
   * @returns Object with UPC string and stream handle for cleanup, or null if scan failed
   */
  async scanAndLookupStream(
    messageId: string,
    onChunk: (data: SearchFoodPhraseResponse) => void,
    onComplete: () => void,
    onError: (error: any) => void
  ): Promise<{ upc: string; stream: any } | null> {
    try {
      // Track scan initiated
      this.analyticsService.trackEvent('barcode_scan_initiated', {});

      // Scan the barcode
      const upc = await this.cameraService.scanBarcode();

      if (!upc) {
        console.log('[BarcodeService] Scan cancelled or failed');
        return null;
      }

      // Provide haptic feedback
      try {
        await Haptics.impact({ style: ImpactStyle.Medium });
      } catch (e) {
        // Haptics not available on web, ignore
      }

      console.log('[BarcodeService] UPC scanned:', upc);

      // Show loading toast
      await this.toastService.showToast({
        message: 'Looking up barcode...',
        duration: 2000,
        color: 'success'
      });

      // Track scan success
      this.analyticsService.trackEvent('barcode_scan_success', { upc });

      // Start the stream
      const stream = await this.chatStreamService.barcodeScanStream(
        new BarcodeSearchRequest({ upc, messageId }),
        onChunk,
        () => {
          // Provide success haptic
          try {
            Haptics.impact({ style: ImpactStyle.Light });
          } catch (e) {
            // Ignore
          }
          onComplete();
        },
        (error) => {
          console.error('[BarcodeService] Stream error:', error);

          // Track error
          this.analyticsService.trackEvent('barcode_scan_failed', {
            upc,
            reason: 'stream_error',
            error: error instanceof Error ? error.message : 'unknown'
          });

          this.toastService.showToast({
            message: 'Failed to process barcode. Please try again.',
            duration: 3000,
            color: 'danger'
          });

          onError(error);
        }
      );

      return { upc, stream };
    } catch (error) {
      console.error('[BarcodeService] Error during scan and lookup:', error);

      // Track error
      this.analyticsService.trackEvent('barcode_scan_failed', {
        reason: 'error',
        error: error instanceof Error ? error.message : 'unknown'
      });

      await this.toastService.showToast({
        message: 'Failed to scan barcode. Please try again.',
        duration: 3000,
        color: 'danger'
      });

      onError(error);
      return null;
    }
  }
}

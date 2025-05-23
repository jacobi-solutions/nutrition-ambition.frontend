import { Injectable } from '@angular/core';
import { ToastController } from '@ionic/angular/standalone';

export interface ToastOptions {
  message: string;
  duration?: number;
  color?: string;
  position?: 'top' | 'bottom' | 'middle';
  buttons?: any[];
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  constructor(private toastController: ToastController) {}

  /**
   * Show a toast notification
   */
  async showToast(options: ToastOptions): Promise<HTMLIonToastElement> {
    const toast = await this.toastController.create({
      message: options.message,
      duration: options.duration || 3000,
      color: options.color || 'primary',
      position: options.position || 'bottom',
      buttons: options.buttons || []
    });

    await toast.present();
    return toast;
  }

  /**
   * Show a toast with an undo button
   */
  async showUndoToast(message: string, onUndo: () => void): Promise<HTMLIonToastElement> {
    return this.showToast({
      message,
      duration: 4000,
      buttons: [
        {
          text: 'Undo',
          role: 'cancel',
          handler: () => {
            onUndo();
          }
        }
      ]
    });
  }
} 
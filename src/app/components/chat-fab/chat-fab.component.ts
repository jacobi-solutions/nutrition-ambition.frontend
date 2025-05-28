import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonFab, IonFabButton, IonFabList, IonIcon } from '@ionic/angular/standalone';
import { AnimationController } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  cameraOutline, 
  createOutline, 
  barcodeOutline, 
  addOutline, 
  closeOutline 
} from 'ionicons/icons';

@Component({
  selector: 'app-chat-fab',
  standalone: true,
  imports: [
    CommonModule,
    IonFab,
    IonFabButton,
    IonFabList,
    IonIcon
  ],
  template: `
    <ion-fab slot="fixed" vertical="bottom" horizontal="end" class="mb-16 mr-4">
      <ion-fab-button (click)="toggleFab()" [color]="isOpen ? 'light' : 'primary'" class="shadow-lg">
        <ion-icon [name]="isOpen ? 'close-outline' : 'add-outline'"></ion-icon>
      </ion-fab-button>
      <ion-fab-list side="top" [activated]="isOpen" #fabList>
        <ion-fab-button color="light" (click)="handleAction('photo')" class="my-2 shadow" title="Take a photo">
          <ion-icon name="camera-outline"></ion-icon>
        </ion-fab-button>
        <ion-fab-button color="light" (click)="handleAction('barcode')" class="my-2 shadow" title="Scan barcode">
          <ion-icon name="barcode-outline"></ion-icon>
        </ion-fab-button>
        <ion-fab-button color="light" (click)="handleAction('edit')" class="my-2 shadow" title="Manual entry">
          <ion-icon name="create-outline"></ion-icon>
        </ion-fab-button>
      </ion-fab-list>
    </ion-fab>
  `,
  styles: [`
    ion-fab-button {
      --box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
      transition: transform 0.2s ease;
    }
    
    ion-fab-button:hover {
      transform: scale(1.05);
    }
    
    ion-fab-list {
      transition: opacity 0.3s ease, transform 0.3s ease;
    }
    
    ion-fab-list.activated {
      opacity: 1;
      transform: translateY(0);
    }
    
    ion-fab-list:not(.activated) {
      opacity: 0;
      transform: translateY(20px);
    }
  `]
})
export class ChatFabComponent {
  private animationCtrl = inject(AnimationController);
  isOpen = false;

  constructor() {
    addIcons({
      cameraOutline,
      createOutline,
      barcodeOutline,
      addOutline,
      closeOutline
    });
  }

  toggleFab() {
    this.isOpen = !this.isOpen;
  }

  handleAction(action: 'photo' | 'barcode' | 'edit') {
    console.log(`FAB action clicked: ${action}`);
    
    // Here we would implement the actual functionality
    switch(action) {
      case 'photo':
        console.log('Opening camera...');
        break;
      case 'barcode':
        console.log('Opening barcode scanner...');
        break;
      case 'edit':
        console.log('Opening manual entry...');
        break;
    }
    
    // Close the FAB after action is clicked
    setTimeout(() => {
      this.isOpen = false;
    }, 300);
  }
} 
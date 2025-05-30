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
  templateUrl: './chat-fab.component.html',
  styleUrls: ['./chat-fab.component.scss']
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
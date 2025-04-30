import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';

@Component({
  selector: 'app-floating-action-button',
  templateUrl: './floating-action-button.component.html',
  styleUrls: ['./floating-action-button.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule]
})
export class FloatingActionButtonComponent {
  @Output() takePhoto = new EventEmitter<void>();
  @Output() scanBarcode = new EventEmitter<void>();
  @Output() quickAdd = new EventEmitter<void>();

  constructor() { }

  onTakePhoto(): void {
    this.takePhoto.emit();
  }

  onScanBarcode(): void {
    this.scanBarcode.emit();
  }

  onQuickAdd(): void {
    this.quickAdd.emit();
  }
} 
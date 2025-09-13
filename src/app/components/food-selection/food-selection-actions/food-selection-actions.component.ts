import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonButton } from '@ionic/angular/standalone';

@Component({
  selector: 'app-food-selection-actions',
  templateUrl: './food-selection-actions.component.html',
  styleUrls: ['./food-selection-actions.component.scss'],
  standalone: true,
  imports: [CommonModule, IonButton]
})
export class FoodSelectionActionsComponent {
  @Input() isSubmitting: boolean = false;
  @Input() isCanceling: boolean = false;
  @Input() isReadOnly: boolean = false;
  @Input() isEditMode: boolean = false;
  @Input() statusText: string = '';
  @Input() isSelectionComplete: boolean = false;

  @Output() confirmSelection = new EventEmitter<void>();
  @Output() cancelSelection = new EventEmitter<void>();

  onConfirmSelection(): void {
    this.confirmSelection.emit();
  }

  onCancelSelection(): void {
    this.cancelSelection.emit();
  }

  // Helper methods for template
  showTypingIndicator(): boolean {
    return (this.isSubmitting || this.isCanceling) && !this.isReadOnly;
  }

  showStatusText(): boolean {
    return !this.isSubmitting && !this.isCanceling && this.isReadOnly;
  }

  showActionButtons(): boolean {
    return !this.isSubmitting && !this.isCanceling && !this.isReadOnly;
  }

  getConfirmButtonText(): string {
    return this.isEditMode ? 'Confirm Edit' : 'Confirm Selection';
  }
}
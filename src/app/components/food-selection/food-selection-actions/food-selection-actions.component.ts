import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonButton } from '@ionic/angular/standalone';

@Component({
  selector: 'app-food-selection-actions',
  templateUrl: './food-selection-actions.component.html',
  styleUrls: ['./food-selection-actions.component.scss'],
  standalone: true,
  imports: [CommonModule, IonButton]
})
export class FoodSelectionActionsComponent implements OnInit, OnChanges {
  @Input() isSubmitting: boolean = false;
  @Input() isCanceling: boolean = false;
  @Input() isReadOnly: boolean = false;
  @Input() isEditMode: boolean = false;
  @Input() isLoading: boolean = false; // Streaming/loading state
  @Input() statusText: string = '';

  // Precomputed values for performance
  computedShowTypingIndicator: boolean = false;
  computedShowStatusText: boolean = false;
  computedShowActionButtons: boolean = false;
  computedConfirmButtonText: string = '';

  @Output() confirmSelection = new EventEmitter<void>();
  @Output() cancelSelection = new EventEmitter<void>();

  onConfirmSelection(): void {
    this.confirmSelection.emit();
  }

  onCancelSelection(): void {
    this.cancelSelection.emit();
  }

  ngOnInit() {
    this.computeDisplayValues();
  }

  ngOnChanges(changes: SimpleChanges) {
    this.computeDisplayValues();
  }

  private computeDisplayValues(): void {
    // Show typing indicator when submitting, canceling, or loading (streaming)
    this.computedShowTypingIndicator = (this.isSubmitting || this.isCanceling || this.isLoading) && !this.isReadOnly;
    this.computedShowStatusText = !this.isSubmitting && !this.isCanceling && !this.isLoading && this.isReadOnly;
    // Hide action buttons during loading/streaming
    this.computedShowActionButtons = !this.isSubmitting && !this.isCanceling && !this.isReadOnly && !this.isLoading;
    this.computedConfirmButtonText = this.isEditMode ? 'Confirm Edit' : 'Confirm Selection';
  }

  // Helper methods for template (deprecated - use precomputed values)
  showTypingIndicator(): boolean {
    return this.computedShowTypingIndicator;
  }

  showStatusText(): boolean {
    return this.computedShowStatusText;
  }

  showActionButtons(): boolean {
    return this.computedShowActionButtons;
  }

  getConfirmButtonText(): string {
    return this.computedConfirmButtonText;
  }
}
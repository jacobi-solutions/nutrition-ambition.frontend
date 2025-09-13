import { Component, Input, Output, EventEmitter, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { send, addCircleOutline } from 'ionicons/icons';

@Component({
  selector: 'app-add-food',
  templateUrl: './add-food.component.html',
  styleUrls: ['./add-food.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonIcon]
})
export class AddFoodComponent {
  @Input() isReadOnly: boolean = false;
  @Input() isEditMode: boolean = false;
  @Input() hasPayload: boolean = false;

  @Output() foodAdded = new EventEmitter<string>();

  @ViewChild('addFoodTextarea', { static: false }) addFoodTextarea!: ElementRef<HTMLTextAreaElement>;

  isAddingFood = false;
  newFoodPhrase = '';
  isSubmittingNewFood = false;

  constructor() {
    addIcons({ send, addCircleOutline });
  }

  startAddingFood(): void {
    this.isAddingFood = true;
    this.newFoodPhrase = '';

    // Focus the textarea after view update
    setTimeout(() => {
      if (this.addFoodTextarea) {
        this.addFoodTextarea.nativeElement.focus();
      }
    }, 50);
  }

  cancelAddingFood(): void {
    this.isAddingFood = false;
    this.newFoodPhrase = '';
    this.isSubmittingNewFood = false;
  }

  sendNewFood(): void {
    if (!this.newFoodPhrase?.trim() || this.isSubmittingNewFood) {
      return;
    }

    this.isSubmittingNewFood = true;
    this.foodAdded.emit(this.newFoodPhrase.trim());
  }

  onAddFoodKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendNewFood();
    } else if (event.key === 'Escape') {
      this.cancelAddingFood();
    }
  }

  onAddFoodBlur(event: FocusEvent): void {
    // Don't cancel if user clicked the send button
    const relatedTarget = event.relatedTarget as HTMLElement;
    if (relatedTarget && relatedTarget.classList.contains('send-button')) {
      return;
    }

    // Small timeout to allow for button clicks
    setTimeout(() => {
      if (!this.newFoodPhrase?.trim()) {
        this.cancelAddingFood();
      }
    }, 150);
  }

  autoResizeTextarea(textarea: HTMLTextAreaElement): void {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 72) + 'px'; // Max 3 rows (72px)
  }

  // Reset state when submission is complete
  resetSubmissionState(): void {
    this.isSubmittingNewFood = false;
    this.cancelAddingFood();
  }
}
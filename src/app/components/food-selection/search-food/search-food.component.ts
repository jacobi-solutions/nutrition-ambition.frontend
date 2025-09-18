import { Component, Input, Output, EventEmitter, ViewChild, ElementRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { send, addCircleOutline } from 'ionicons/icons';

@Component({
  selector: 'app-search-food',
  templateUrl: './search-food.component.html',
  styleUrls: ['./search-food.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonIcon]
})
export class SearchFoodComponent implements OnInit {
  @Input() initialPhrase: string = '';
  @Input() placeholder: string = 'What did you eat?';
  @Input() isVisible: boolean = false;

  @Output() phraseSubmitted = new EventEmitter<string>();
  @Output() editCanceled = new EventEmitter<void>();

  @ViewChild('addFoodTextarea', { static: false }) addFoodTextarea!: ElementRef<HTMLTextAreaElement>;

  currentPhrase = '';
  isSubmittingNewFood = false;

  constructor() {
    addIcons({ send, addCircleOutline });
  }

  ngOnInit(): void {
    this.currentPhrase = this.initialPhrase;
    // Focus the textarea after view update
    setTimeout(() => {
      if (this.addFoodTextarea) {
        this.addFoodTextarea.nativeElement.focus();
      }
    }, 50);
  }

  cancel(): void {
    this.editCanceled.emit();
  }

  submitPhrase(): void {
    if (!this.currentPhrase?.trim() || this.isSubmittingNewFood) {
      return;
    }

    this.isSubmittingNewFood = true;
    this.phraseSubmitted.emit(this.currentPhrase.trim());
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.submitPhrase();
    } else if (event.key === 'Escape') {
      this.cancel();
    }
  }

  onBlur(event: FocusEvent): void {
    // Don't cancel if user clicked the send button
    const relatedTarget = event.relatedTarget as HTMLElement;
    if (relatedTarget && relatedTarget.classList.contains('send-button')) {
      return;
    }

    // Small timeout to allow for button clicks
    setTimeout(() => {
      
        this.cancel();
      
    }, 150);
  }

  onTextareaInput(event: Event): void {
    const target = event.target as HTMLTextAreaElement;
    if (target) {
      this.autoResizeTextarea(target);
    }
  }

  autoResizeTextarea(textarea: HTMLTextAreaElement): void {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 72) + 'px'; // Max 3 rows (72px)
  }

  // Reset state when submission is complete
  resetSubmissionState(): void {
    this.isSubmittingNewFood = false;
  }

  // Check if there are changes from the initial value
  hasChanges(): boolean {
    return this.currentPhrase.trim() !== this.initialPhrase.trim() && this.currentPhrase.trim().length > 0;
  }
}
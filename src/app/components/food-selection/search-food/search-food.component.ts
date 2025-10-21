import { Component, Input, Output, EventEmitter, ViewChild, ElementRef, OnInit, OnChanges, SimpleChanges } from '@angular/core';
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
export class SearchFoodComponent implements OnInit, OnChanges {
  @Input() initialPhrase: string = '';
  @Input() placeholder: string = 'What did you eat?';
  @Input() isVisible: boolean = false;
  @Input() mode: 'default' | 'quick' = 'default';
  @Input() searchResults: any[] = [];
  @Input() isSearching: boolean = false;

  @Output() phraseSubmitted = new EventEmitter<string>();
  @Output() editCanceled = new EventEmitter<void>();
  @Output() instantSearch = new EventEmitter<string>();
  @Output() resultSelected = new EventEmitter<any>();

  @ViewChild('addFoodTextarea', { static: false }) addFoodTextarea!: ElementRef<HTMLTextAreaElement>;

  currentPhrase = '';
  isSubmittingNewFood = false;
  showDropdown = false;

  constructor() {
    addIcons({ send, addCircleOutline });
  }

  ngOnInit(): void {
    this.currentPhrase = this.initialPhrase;
    // Focus the textarea and set initial height after view update
    setTimeout(() => {
      if (this.addFoodTextarea) {
        const textarea = this.addFoodTextarea.nativeElement;
        textarea.style.height = '38px'; // Start with single-line height
        textarea.focus();
      }
    }, 50);
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Reset textarea height when mode changes or when becoming visible
    if ((changes['mode'] && !changes['mode'].firstChange) ||
        (changes['isVisible'] && changes['isVisible'].currentValue === true)) {
      setTimeout(() => {
        if (this.addFoodTextarea) {
          const textarea = this.addFoodTextarea.nativeElement;
          textarea.style.height = '38px'; // Reset to initial single-line height
        }
      }, 0);
    }

    // If mode changed to 'quick' and there's already text, trigger instant search
    if (changes['mode'] && !changes['mode'].firstChange) {
      if (this.mode === 'quick' && this.currentPhrase.trim().length >= 3) {
        this.showDropdown = true;
        this.instantSearch.emit(this.currentPhrase.trim());
      }
    }
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

  // onBlur(event: FocusEvent): void {
  //   // Don't cancel if user clicked the send button
  //   const relatedTarget = event.relatedTarget as HTMLElement;
  //   if (relatedTarget && relatedTarget.classList.contains('send-button')) {
  //     return;
  //   }

  //   // Small timeout to allow for button clicks
  //   setTimeout(() => {
      
  //       this.cancel();
      
  //   }, 150);
  // }

  onTextareaInput(event: Event): void {
    const target = event.target as HTMLTextAreaElement;
    if (target) {
      // Only auto-resize in default mode
      if (this.mode === 'default') {
        this.autoResizeTextarea(target);
      }

      // Emit instant search in quick mode
      if (this.mode === 'quick') {
        if (this.currentPhrase.trim().length > 0) {
          this.showDropdown = true;
          this.instantSearch.emit(this.currentPhrase.trim());
        } else {
          this.showDropdown = false;
        }
      }
    }
  }

  selectResult(result: any): void {
    this.showDropdown = false;
    this.resultSelected.emit(result);
  }

  autoResizeTextarea(textarea: HTMLTextAreaElement): void {
    // Reset to min height to get accurate scrollHeight measurement
    textarea.style.height = '38px';

    // Only grow if content actually overflows
    if (textarea.scrollHeight > 38) {
      textarea.style.height = Math.min(textarea.scrollHeight, 72) + 'px'; // Max 3 rows (72px)
    }
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
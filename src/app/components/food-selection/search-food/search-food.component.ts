import { Component, Input, Output, EventEmitter, ViewChild, ElementRef, OnInit, OnChanges, SimpleChanges, HostListener } from '@angular/core';
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
  @Input() mode: 'default' | 'quick' | 'favorites' = 'default';
  @Input() searchResults: any[] = [];
  @Input() favoritesData: any[] = [];
  @Input() isSearching: boolean = false;

  @Output() phraseSubmitted = new EventEmitter<string>();
  @Output() editCanceled = new EventEmitter<void>();
  @Output() instantSearch = new EventEmitter<string>();
  @Output() resultSelected = new EventEmitter<any>();

  @ViewChild('addFoodTextarea', { static: false }) addFoodTextarea!: ElementRef<HTMLTextAreaElement>;

  currentPhrase = '';
  isSubmittingNewFood = false;
  showDropdown = false;
  private clickListenerEnabled = false;

  constructor(private elementRef: ElementRef) {
    addIcons({ send, addCircleOutline });
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    // Only handle clicks if dropdown is showing, listener is enabled, and we're in quick or favorites mode
    if (this.clickListenerEnabled && this.showDropdown && (this.mode === 'quick' || this.mode === 'favorites')) {
      const clickedInside = this.elementRef.nativeElement.contains(event.target);
      if (!clickedInside) {
        // Clicked outside - close dropdown without selecting
        this.showDropdown = false;
        this.clickListenerEnabled = false;
      }
    }
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

    // If mode changed, handle dropdown visibility
    if (changes['mode'] && !changes['mode'].firstChange) {
      if (this.mode === 'quick' && this.currentPhrase.trim().length >= 3) {
        this.showDropdown = true;
        this.instantSearch.emit(this.currentPhrase.trim());
        // Enable click listener after a short delay to prevent immediate closure
        setTimeout(() => {
          this.clickListenerEnabled = true;
        }, 100);
      } else if (this.mode === 'favorites') {
        // Auto-show dropdown for favorites mode
        this.showDropdown = true;
        this.currentPhrase = ''; // Clear search text when switching to favorites
        // Enable click listener after a short delay to prevent immediate closure
        setTimeout(() => {
          this.clickListenerEnabled = true;
        }, 100);
      } else {
        this.showDropdown = false;
        this.clickListenerEnabled = false;
      }
    }

    // If favoritesData changed and we're in favorites mode, show dropdown
    if (changes['favoritesData'] && this.mode === 'favorites' && this.favoritesData.length > 0) {
      this.showDropdown = true;
      // Enable click listener after a short delay
      setTimeout(() => {
        this.clickListenerEnabled = true;
      }, 100);
    }
  }

  cancel(): void {
    this.editCanceled.emit();
  }

  submitPhrase(): void {
    if (!this.currentPhrase?.trim() || this.isSubmittingNewFood) {
      return;
    }

    const phraseToSubmit = this.currentPhrase.trim();

    // Clear input immediately after submission (don't wait for stream completion)
    this.clear();

    // Emit the phrase after clearing
    this.phraseSubmitted.emit(phraseToSubmit);
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.submitPhrase();
    } else if (event.key === 'Escape') {
      this.cancel();
    }
  }

  onTextareaClick(): void {
    // Re-open dropdown when clicking in textarea for quick or favorites mode
    if (this.mode === 'quick' && this.currentPhrase.trim().length > 0) {
      this.showDropdown = true;
      // Enable click listener after a short delay
      setTimeout(() => {
        this.clickListenerEnabled = true;
      }, 100);
    } else if (this.mode === 'favorites' && this.favoritesData.length > 0) {
      this.showDropdown = true;
      // Enable click listener after a short delay
      setTimeout(() => {
        this.clickListenerEnabled = true;
      }, 100);
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
          // Enable click listener when dropdown opens via typing
          if (!this.clickListenerEnabled) {
            setTimeout(() => {
              this.clickListenerEnabled = true;
            }, 100);
          }
        } else {
          this.showDropdown = false;
          this.clickListenerEnabled = false;
        }
      }

      // Show filtered favorites in favorites mode
      if (this.mode === 'favorites') {
        this.showDropdown = true;
        // Enable click listener if not already enabled
        if (!this.clickListenerEnabled) {
          setTimeout(() => {
            this.clickListenerEnabled = true;
          }, 100);
        }
      }
    }
  }

  // Check if dropdown should be shown
  get shouldShowDropdown(): boolean {
    if (this.mode === 'quick') {
      return this.showDropdown && (this.isSearching || this.searchResults.length > 0);
    }
    if (this.mode === 'favorites') {
      return this.showDropdown && this.filteredFavorites.length > 0;
    }
    return false;
  }

  // Filter favorites locally based on input text
  get filteredFavorites(): any[] {
    if (this.mode !== 'favorites') return [];

    const query = this.currentPhrase.toLowerCase().trim();
    if (!query) return this.favoritesData;

    return this.favoritesData.filter(fav => {
      const name = (fav.foodSnapshot?.name || '').toLowerCase();
      const brand = (fav.foodSnapshot?.brand || '').toLowerCase();
      const description = (fav.foodSnapshot?.description || '').toLowerCase();
      return name.includes(query) || brand.includes(query) || description.includes(query);
    });
  }

  // Get display results for the dropdown (either search results or filtered favorites)
  get displayResults(): any[] {
    if (this.mode === 'quick') {
      return this.searchResults;
    }
    if (this.mode === 'favorites') {
      // Map favorites to match quick search result format
      return this.filteredFavorites.map(fav => {
        // Try to get photo from food-level or first component's first match
        const foodPhoto = fav.foodSnapshot?.photoThumb;
        const componentPhoto = fav.foodSnapshot?.components?.[0]?.matches?.[0]?.photoThumb;
        const photoThumb = foodPhoto || componentPhoto;

        // Build display name with component count if multi-component
        let displayName = fav.foodSnapshot?.name || 'Unknown food';
        const componentCount = fav.foodSnapshot?.components?.length || 0;

        if (componentCount > 1) {
          // Multi-component food - show component count
          displayName = `${displayName} (${componentCount} components)`;
        }

        return {
          ...fav,
          displayName: displayName,
          brandName: fav.foodSnapshot?.brand,
          photoThumb: photoThumb
        };
      });
    }
    return [];
  }

  selectResult(result: any): void {
    this.showDropdown = false;
    this.clickListenerEnabled = false;
    this.clear(); // Clear input immediately when selecting from dropdown
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

  // Clear the search input
  clear(): void {
    this.currentPhrase = '';
    this.showDropdown = false;
    this.clickListenerEnabled = false;
    this.isSubmittingNewFood = false; // Reset submission state
    if (this.addFoodTextarea) {
      const textarea = this.addFoodTextarea.nativeElement;
      textarea.style.height = '38px'; // Reset to initial height
    }
  }

  // Check if there are changes from the initial value
  hasChanges(): boolean {
    return this.currentPhrase.trim() !== this.initialPhrase.trim() && this.currentPhrase.trim().length > 0;
  }
}
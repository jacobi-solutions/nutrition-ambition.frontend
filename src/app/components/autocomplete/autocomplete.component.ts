import { Component, Input, Output, EventEmitter, ViewChild, AfterViewInit, OnChanges, OnInit, SimpleChanges, ChangeDetectorRef, forwardRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { NgSelectModule, NgSelectComponent } from '@ng-select/ng-select';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

export interface AutocompleteItem {
  [key: string]: any;
}

interface DisplayItem {
  value: any;
  disabled: boolean;
  hasDisplayName: boolean;
  hasBrandName: boolean;
  hasName: boolean;
  hasBrand: boolean;
  displayName: string;
  brandName: string;
  name: string;
  brand: string;
  label: string;
  displayText: string;
  cleanDisplayText: string;
  originalItem: any;
  showInDropdown?: boolean;
}

@Component({
  selector: 'app-autocomplete',
  templateUrl: './autocomplete.component.html',
  styleUrls: ['./autocomplete.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, NgSelectModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => AutocompleteComponent),
      multi: true
    }
  ]
})
export class AutocompleteComponent<T = any> implements OnInit, AfterViewInit, OnChanges, OnDestroy, ControlValueAccessor {
  @Input() items: T[] = [];
  @Input() bindLabel: string = 'name';
  @Input() bindValue: string | null = null;
  @Input() placeholder: string = 'Select...';
  @Input() disabled = false;
  @Input() clearable = true;
  @Input() searchable = true;
  @Input() loading = false;
  @Input() autoFocusOnOpen = false;
  @Input() initialSearchText: string = '';

  @Output() selectionChange = new EventEmitter<T | T[] | null>();
  @Output() searchChange = new EventEmitter<string>();
  @Output() focus = new EventEmitter<void>();
  @Output() open = new EventEmitter<void>();
  @Output() clear = new EventEmitter<void>();

  // Internal state for ng-select binding
  internalValue: T | T[] | null = null;
  isFocused = false;

  // Dummy object to show as selected to display the search phrase
  dummyDisplayItem: any = null;

  @ViewChild(NgSelectComponent) ngSelect?: NgSelectComponent;

  // Track the current display text for inline editing
  currentDisplayText = '';
  isEditing = false;
  isDropdownOpen = false;

  // Computed properties for template
  ngModelOptions = { standalone: true };
  displayItems: DisplayItem[] = [];

  // Debouncing for search
  private searchSubject = new Subject<string>();
  private searchSubscription?: Subscription;


  // ControlValueAccessor implementation
  private onChange = (value: T | T[] | null) => {};
  private onTouched = () => {};

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    // Initialize internal value
    this.internalValue = null;
    this.updateDisplayItems();

    // Initialize display text with initial search text
    this.currentDisplayText = this.initialSearchText || '';
    this.updateDummyDisplayItem();

    // Set up debounced search
    this.searchSubscription = this.searchSubject.pipe(
      debounceTime(300), // Wait 300ms after user stops typing (per Nutritionix recommendations)
      distinctUntilChanged() // Only emit if the search term changed
    ).subscribe(searchTerm => {
      // Update the display text to match current search
      // this.currentDisplayText = searchTerm;
      // this.updateDummyDisplayItem();
      // Only emit if we have at least 3 characters (per Nutritionix recommendations)
      if (searchTerm.length >= 3) {
        this.searchChange.emit(searchTerm);
      }
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['items']) {
      this.updateDisplayItems();
    }
    if (changes['items'] && this.internalValue !== null) {
      // Slight delay to ensure items are populated before updating display
      setTimeout(() => this.cdr.detectChanges(), 0);
    }
    if (changes['initialSearchText']) {
      // Update display text when initial search text changes
      this.currentDisplayText = this.initialSearchText || '';
      // this.updateDummyDisplayItem();
    }
  }

  ngAfterViewInit(): void {
    // Additional change detection after view is initialized
    if (this.internalValue !== null) {
      this.cdr.detectChanges();
    }

    if (this.autoFocusOnOpen && this.ngSelect) {
      // Delay to ensure component is fully rendered
      setTimeout(() => {
        try {
          this.ngSelect!.focus();
          this.ngSelect!.open();
        } catch (error) {
          // Silently handle any focus errors
        }
      }, 0);
    }
  }

  // ControlValueAccessor methods
  writeValue(value: T | T[] | null): void {
    this.internalValue = value;
    this.cdr.detectChanges();
  }

  registerOnChange(fn: (value: T | T[] | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
    this.cdr.detectChanges();
  }

  // Event handlers
  onSelectionChange(value: any): void {
    // Don't process dummy selections
    if (value === this.dummyDisplayItem || value === '__dummy_display__') {
      return;
    }

    // Update the display text to the selected item's name for future searches
    if (value) {
      const selectedItem = this.displayItems.find(item => item.value === value);
      if (selectedItem) {
        this.currentDisplayText = selectedItem.cleanDisplayText;
        this.updateDummyDisplayItem();
        // Force immediate update
        this.cdr.detectChanges();
      }
    }

    // Emit the selection for parent to handle
    this.selectionChange.emit(value);

    // Close the dropdown after selection
    this.closeDropdown();
  }

  onSearch(searchTerm: { term: string }): void {
    // Push search term through debounce pipeline instead of emitting immediately
    this.searchSubject.next(searchTerm.term);
  }

  onClear(): void {
    this.internalValue = null;
    this.onChange(this.internalValue);
    this.selectionChange.emit(this.internalValue);
  }

  onFocus(): void {
    this.isFocused = true;
    this.isEditing = true;
    this.focus.emit();
  }

  onBlur(): void {
    this.isFocused = false;
    this.isEditing = false;
    this.onTouched();
  }

  onOpen(): void {
    this.isDropdownOpen = true;

    // Immediately remove dummy and force change detection
    this.dummyDisplayItem = null;
    this.displayItems = this.displayItems.filter(item => item.value !== '__dummy_display__');
    this.cdr.detectChanges();

    // Pre-populate search input with current display text
    setTimeout(() => {
      if (this.ngSelect?.searchInput && this.currentDisplayText) {
        const searchInputElement = this.ngSelect.searchInput()?.nativeElement;
        if (searchInputElement) {
          searchInputElement.value = this.currentDisplayText;
          // Move cursor to end of text
          searchInputElement.setSelectionRange(this.currentDisplayText.length, this.currentDisplayText.length);
        }
      }
    }, 10);
    this.open.emit();
  }

  onClose(): void {
    this.isDropdownOpen = false;

    // Add dummy back when closing if we have display text
    // if (this.currentDisplayText) {
    //   this.updateDummyDisplayItem();
    //   this.cdr.detectChanges();
    // }

  }

  // Public methods
  openDropdown(): void {
    this.ngSelect?.open();
  }

  closeDropdown(): void {
    this.ngSelect?.close();
  }

  focusInput(): void {
    this.ngSelect?.focus();
  }

  clearSelection(): void {
    this.onClear();
  }

  // Helper method for trackBy
  trackByValue = (_index: number, item: any) => {
    // Handle displayItem structure
    if (item && typeof item === 'object' && 'originalItem' in item) {
      const originalItem = item.originalItem || item.value;
      if (originalItem && originalItem.id) {
        return originalItem.id;
      }
      return item.cleanDisplayText || item.value;
    }

    // Fallback for direct item tracking
    if (this.bindValue && item) {
      return item[this.bindValue];
    }
    return item;
  };



  private updateDisplayItems(): void {
    // Start with regular items
    this.displayItems = this.items.map(item => {
      const itemObj = item && typeof item === 'object' ? item as any : {};

      // Compute plain display text for the input field (clean, readable text)
      let displayText = '';
      let cleanDisplayText = '';

      if (itemObj.displayName) {
        displayText = itemObj.displayName;
        cleanDisplayText = itemObj.displayName; // Clean version without brands for input
      } else if (itemObj.name) {
        displayText = itemObj.name;
        cleanDisplayText = itemObj.name;
      } else if (this.bindLabel && itemObj[this.bindLabel]) {
        displayText = itemObj[this.bindLabel];
        cleanDisplayText = itemObj[this.bindLabel];
      } else {
        displayText = String(item || '');
        cleanDisplayText = String(item || '');
      }

      return {
        // Value should be what the parent component expects (the original item or specific field)
        value: this.bindValue && itemObj ? itemObj[this.bindValue] : item,
        disabled: itemObj.disabled === true,
        hasDisplayName: 'displayName' in itemObj && !!itemObj.displayName,
        hasBrandName: 'brandName' in itemObj && !!itemObj.brandName,
        hasName: 'name' in itemObj && !!itemObj.name,
        hasBrand: 'brand' in itemObj && !!itemObj.brand,
        displayName: itemObj.displayName || '',
        brandName: itemObj.brandName || '',
        name: itemObj.name || '',
        brand: itemObj.brand || '',
        label: this.bindLabel && itemObj ? (itemObj[this.bindLabel] || '') : String(item || ''),
        displayText: displayText,
        cleanDisplayText: cleanDisplayText,
        originalItem: item,
        showInDropdown: true
      };
    });

    // Only add dummy display item if we have text to show and dropdown is closed
    this.updateDummyDisplayItem();
  }

  private updateDummyDisplayItem(): void {
    if (this.currentDisplayText) {
      this.dummyDisplayItem = {
        value: '__dummy_display__',
        disabled: false,
        hasDisplayName: true,
        hasBrandName: false,
        hasName: false,
        hasBrand: false,
        displayName: this.currentDisplayText,
        brandName: '',
        name: '',
        brand: '',
        label: this.currentDisplayText,
        displayText: this.currentDisplayText,
        cleanDisplayText: this.currentDisplayText,
        originalItem: null,
        showInDropdown: false
      };

      // Remove any existing dummy item and add new one at beginning
      // this.displayItems = this.displayItems.filter(item => item.value !== '__dummy_display__');
      // this.displayItems.unshift(this.dummyDisplayItem);
    } else {
      this.dummyDisplayItem = null;
      // this.displayItems = this.displayItems.filter(item => item.value !== '__dummy_display__');
    }
  }

  trackByDisplayItem = (index: number, displayItem: DisplayItem) => {
    // Use the unique id from the original item if it's a ComponentMatchDisplay
    const originalItem = displayItem.originalItem || displayItem.value;
    let key;
    if (originalItem && originalItem.id) {
      key = originalItem.id;
    } else {
      // Fallback to cleanDisplayText or index
      key = displayItem.cleanDisplayText || index;
    }
    return key;
  };

  // Custom search function - disable ng-select's default filtering
  // Return true for all items so ng-select doesn't filter them
  // We handle filtering via API calls instead
  customSearchFn = (_term: string, _item: any) => {
    return true; // Always show all items, let API handle the filtering
  };

  ngOnDestroy(): void {
    // Clean up search subscription
    if (this.searchSubscription) {
      this.searchSubscription.unsubscribe();
    }
  }
}
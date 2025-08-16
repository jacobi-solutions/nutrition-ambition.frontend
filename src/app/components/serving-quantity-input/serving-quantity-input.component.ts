import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-serving-quantity-input',
  template: `
    <div class="quantity-stepper" [class.disabled]="disabled">
      <button 
        type="button" 
        class="step-button step-minus"
        [disabled]="disabled || value <= min"
        (click)="decrease()"
        [attr.aria-label]="'Decrease ' + ariaLabel">
        −
      </button>
      
      <input 
        type="number"
        class="quantity-input"
        [value]="formatValue(value)"
        [min]="min"
        [max]="max"
        [step]="step"
        [disabled]="disabled"
        [attr.aria-label]="ariaLabel"
        (input)="onInput($event)"
        (blur)="onBlur($event)"
        (keydown.enter)="onBlur($event)"
        (click)="$event.stopPropagation()">
      
      <button 
        type="button" 
        class="step-button step-plus"
        [disabled]="disabled || value >= max"
        (click)="increase()"
        [attr.aria-label]="'Increase ' + ariaLabel">
        +
      </button>
    </div>
  `,
  styles: [`
    .quantity-stepper {
      display: flex;
      align-items: center;
      gap: 1px;
      background: transparent;
      padding: 0;
    }

    .quantity-stepper.disabled {
      opacity: 0.6;
      pointer-events: none;
    }

    .step-button {
      width: 24px;
      height: 24px;
      border: none;
      border-radius: 50%;
      background: var(--ion-color-medium);
      color: var(--ion-color-medium-contrast);
      font-size: 14px;
      font-weight: bold;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: none;
      flex-shrink: 0;
    }

    .step-button:hover:not(:disabled) {
      background: var(--ion-color-primary);
      color: var(--ion-color-primary-contrast);
      transform: scale(1.05);
    }

    .step-button:disabled {
      opacity: 0.4;
      cursor: not-allowed;
      transform: none;
    }

    .quantity-input {
      width: 2.5rem;
      height: 24px;
      border: none;
      border-radius: 4px;
      text-align: center;
      font-size: 14px;
      font-weight: 500;
      background: transparent;
      color: var(--ion-color-dark);
      outline: none;
      box-shadow: none;
      margin: 0 1px;
    }

    .quantity-input:focus {
      outline: none;
      box-shadow: none;
      border: none;
    }

    .quantity-input:disabled {
      background: transparent;
      color: var(--ion-color-medium);
    }

    /* Remove number input spinners */
    .quantity-input::-webkit-outer-spin-button,
    .quantity-input::-webkit-inner-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }

    .quantity-input[type=number] {
      -moz-appearance: textfield;
    }
  `],
  standalone: true,
  imports: [CommonModule, FormsModule]
})
export class ServingQuantityInputComponent {
  @Input() value: number = 1;
  @Input() min: number = 0.1;
  @Input() max: number = 999;
  @Input() step: number = 1;
  @Input() disabled: boolean = false;
  @Input() ariaLabel: string = 'Quantity';

  @Output() valueChange = new EventEmitter<number>();

  private clamp(val: number): number {
    if (!isFinite(val) || isNaN(val) || val < 0) {
      return this.min;
    }
    return Math.max(this.min, Math.min(this.max, val));
  }

  private emitValue(newValue: number): void {
    const clamped = this.clamp(newValue);
    if (clamped !== this.value) {
      this.value = clamped;
      this.valueChange.emit(this.value);
    }
  }

  decrease(): void {
    if (this.disabled) return;
    const newValue = this.value - this.step;
    this.emitValue(newValue);
  }

  increase(): void {
    if (this.disabled) return;
    const newValue = this.value + this.step;
    this.emitValue(newValue);
  }

  formatValue(val: number): string {
    if (!isFinite(val) || isNaN(val)) return '1';
    // Round to 2 decimal places and remove trailing zeros
    const rounded = Math.round(val * 100) / 100;
    return rounded.toString();
  }

  onInput(event: Event): void {
    if (this.disabled) return;
    const target = event.target as HTMLInputElement;
    const newValue = parseFloat(target.value);
    // Emit immediately on input, but don't clamp yet (allow intermediate values)
    if (isFinite(newValue) && !isNaN(newValue)) {
      this.value = newValue;
      this.valueChange.emit(newValue);
    }
  }

  onBlur(event: Event): void {
    if (this.disabled) return;
    const target = event.target as HTMLInputElement;
    const newValue = parseFloat(target.value);
    // On blur, clamp and emit final value
    this.emitValue(newValue);
    // Update the input display to show the formatted value
    target.value = this.formatValue(this.value);
  }
}

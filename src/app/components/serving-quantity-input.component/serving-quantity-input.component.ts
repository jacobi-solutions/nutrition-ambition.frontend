import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-serving-quantity-input',
  
  templateUrl: './serving-quantity-input.component.html',
  styleUrls: ['./serving-quantity-input.component.scss'],
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

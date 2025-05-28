import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class DateService {
  private readonly selectedDateSubject = new BehaviorSubject<string>(new Date().toISOString());
  
  // Observable that components can subscribe to
  readonly selectedDate$: Observable<string> = this.selectedDateSubject.asObservable();

  constructor() {
    console.log(`[DateService] Initialized with date: ${this.selectedDateSubject.value}`);
  }

  // Get the current selected date as ISO string
  getSelectedDate(): string {
    return this.selectedDateSubject.value;
  }

  // Set a new selected date
  setSelectedDate(isoDate: string): void {
    console.log(`[DateService] Setting date to: ${isoDate}`);
    
    // Ensure we're working with a valid date with time set to noon to avoid timezone issues
    const newDate = new Date(isoDate);
    newDate.setHours(12, 0, 0, 0);
    const normalizedIsoDate = newDate.toISOString();
    
    console.log(`[DateService] Normalized date: ${normalizedIsoDate}`);
    this.selectedDateSubject.next(normalizedIsoDate);
  }

  // Convenience methods for date navigation
  goToPreviousDay(): void {
    console.log(`[DateService] Going to previous day from: ${this.selectedDateSubject.value}`);
    const currentDate = new Date(this.selectedDateSubject.value);
    currentDate.setDate(currentDate.getDate() - 1);
    // Set to noon to avoid timezone issues
    currentDate.setHours(12, 0, 0, 0);
    const newDate = currentDate.toISOString();
    console.log(`[DateService] New date will be: ${newDate}`);
    this.selectedDateSubject.next(newDate);
  }

  goToNextDay(): void {
    console.log(`[DateService] Going to next day from: ${this.selectedDateSubject.value}`);
    const currentDate = new Date(this.selectedDateSubject.value);
    currentDate.setDate(currentDate.getDate() + 1);
    // Set to noon to avoid timezone issues
    currentDate.setHours(12, 0, 0, 0);
    const newDate = currentDate.toISOString();
    console.log(`[DateService] New date will be: ${newDate}`);
    this.selectedDateSubject.next(newDate);
  }

  // Check if a given date is today
  isToday(date: Date): boolean {
    const today = new Date();
    return date.getDate() === today.getDate() && 
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  }
} 
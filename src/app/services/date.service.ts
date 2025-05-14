import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class DateService {
  private readonly selectedDateSubject = new BehaviorSubject<string>(new Date().toISOString());
  
  // Observable that components can subscribe to
  readonly selectedDate$: Observable<string> = this.selectedDateSubject.asObservable();

  constructor() {}

  // Get the current selected date as ISO string
  getSelectedDate(): string {
    return this.selectedDateSubject.value;
  }

  // Set a new selected date
  setSelectedDate(isoDate: string): void {
    this.selectedDateSubject.next(isoDate);
  }

  // Convenience methods for date navigation
  goToPreviousDay(): void {
    const currentDate = new Date(this.selectedDateSubject.value);
    currentDate.setDate(currentDate.getDate() - 1);
    this.selectedDateSubject.next(currentDate.toISOString());
  }

  goToNextDay(): void {
    const currentDate = new Date(this.selectedDateSubject.value);
    currentDate.setDate(currentDate.getDate() + 1);
    this.selectedDateSubject.next(currentDate.toISOString());
  }

  // Check if a given date is today
  isToday(date: Date): boolean {
    const today = new Date();
    return date.getDate() === today.getDate() && 
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  }
} 
// This service stores and exposes dates in local time (yyyy-MM-dd).
// Only use UTC conversion when sending to or receiving from the backend.

import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { format, parseISO, startOfDay, isAfter, startOfToday } from 'date-fns';

@Injectable({
  providedIn: 'root'
})
export class DateService {
  private readonly selectedDateSubject = new BehaviorSubject<string>(format(new Date(), 'yyyy-MM-dd'));

  // Observable that components can subscribe to
  readonly selectedDate$: Observable<string> = this.selectedDateSubject.asObservable();

  constructor() {
  }

  // Get the currently selected/viewing date as local date string (yyyy-MM-dd)
  getSelectedDate(): string {
    return this.selectedDateSubject.value;
  }

  // Get today's actual date (not the viewing date) for new operations like sending messages
  // Always recalculates from current time to ensure accuracy
  getTodayDate(): string {
    return format(new Date(), 'yyyy-MM-dd');
  }

  // Helper method to check if a date is in the future
  private isFutureDate(date: Date): boolean {
    const today = startOfToday();
    return isAfter(startOfDay(date), today);
  }

  // Set a new selected date (expects yyyy-MM-dd format or ISO string)
  setSelectedDate(dateInput: string): void {
    
    // Handle both ISO strings and yyyy-MM-dd format
    let localDateString: string;
    let dateToValidate: Date;
    
    if (dateInput.includes('T')) {
      // ISO string - convert to local date
      dateToValidate = parseISO(dateInput);
      localDateString = format(dateToValidate, 'yyyy-MM-dd');
    } else {
      // Already in yyyy-MM-dd format
      localDateString = dateInput;
      dateToValidate = parseISO(localDateString);
    }
    
    // Prevent setting future dates
    if (this.isFutureDate(dateToValidate)) {
      localDateString = format(new Date(), 'yyyy-MM-dd');
    }
    
    this.selectedDateSubject.next(localDateString);
  }

  // Convenience methods for date navigation
  goToPreviousDay(): void {
    const currentDate = parseISO(this.selectedDateSubject.value);
    currentDate.setDate(currentDate.getDate() - 1);
    
    const newDateString = format(currentDate, 'yyyy-MM-dd');
    this.selectedDateSubject.next(newDateString);
  }

  goToNextDay(): void {
    const currentDate = parseISO(this.selectedDateSubject.value);
    const nextDay = new Date(currentDate);
    nextDay.setDate(nextDay.getDate() + 1);
    
    // Prevent going to future dates
    if (this.isFutureDate(nextDay)) {
      return;
    }
    
    const newDateString = format(nextDay, 'yyyy-MM-dd');
    this.selectedDateSubject.next(newDateString);
  }

  // Check if a given date is today
  isToday(date: Date): boolean {
    const today = new Date();
    return date.getDate() === today.getDate() && 
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  }

  // Utility method to get the selected date as UTC Date object for backend calls
  // @deprecated Use getSelectedDate() which returns the localDateKey string instead
  getSelectedDateUtc(): Date {
    const localDate = parseISO(this.selectedDateSubject.value);
    return startOfDay(localDate);
  }

  // Utility method to set date from UTC Date object (e.g., from backend response)
  setSelectedDateFromUtc(utcDate: Date): void {
    // Prevent setting future dates
    if (this.isFutureDate(utcDate)) {
      const localDateString = format(new Date(), 'yyyy-MM-dd');
      this.selectedDateSubject.next(localDateString);
      return;
    }
    
    const localDateString = format(utcDate, 'yyyy-MM-dd');
    this.selectedDateSubject.next(localDateString);
  }
} 
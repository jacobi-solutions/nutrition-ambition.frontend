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
    console.log(`[DateService] Initialized with date: ${this.selectedDateSubject.value}`);
  }

  // Get the current selected date as local date string (yyyy-MM-dd)
  getSelectedDate(): string {
    return this.selectedDateSubject.value;
  }

  // Helper method to check if a date is in the future
  private isFutureDate(date: Date): boolean {
    const today = startOfToday();
    return isAfter(startOfDay(date), today);
  }

  // Set a new selected date (expects yyyy-MM-dd format or ISO string)
  setSelectedDate(dateInput: string): void {
    console.log(`[DateService] Setting date to: ${dateInput}`);
    
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
      console.log(`[DateService] Cannot set future date: ${localDateString}. Using today instead.`);
      localDateString = format(new Date(), 'yyyy-MM-dd');
    }
    
    console.log(`[DateService] Normalized date: ${localDateString}`);
    this.selectedDateSubject.next(localDateString);
  }

  // Convenience methods for date navigation
  goToPreviousDay(): void {
    console.log(`[DateService] Going to previous day from: ${this.selectedDateSubject.value}`);
    const currentDate = parseISO(this.selectedDateSubject.value);
    currentDate.setDate(currentDate.getDate() - 1);
    
    const newDateString = format(currentDate, 'yyyy-MM-dd');
    console.log(`[DateService] New date will be: ${newDateString}`);
    this.selectedDateSubject.next(newDateString);
  }

  goToNextDay(): void {
    console.log(`[DateService] Going to next day from: ${this.selectedDateSubject.value}`);
    const currentDate = parseISO(this.selectedDateSubject.value);
    const nextDay = new Date(currentDate);
    nextDay.setDate(nextDay.getDate() + 1);
    
    // Prevent going to future dates
    if (this.isFutureDate(nextDay)) {
      console.log(`[DateService] Cannot go to future date. Staying on current date.`);
      return;
    }
    
    const newDateString = format(nextDay, 'yyyy-MM-dd');
    console.log(`[DateService] New date will be: ${newDateString}`);
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
  getSelectedDateUtc(): Date {
    const localDate = parseISO(this.selectedDateSubject.value);
    return startOfDay(localDate);
  }

  // Utility method to set date from UTC Date object (e.g., from backend response)
  setSelectedDateFromUtc(utcDate: Date): void {
    // Prevent setting future dates
    if (this.isFutureDate(utcDate)) {
      console.log(`[DateService] Cannot set future date from UTC. Using today instead.`);
      const localDateString = format(new Date(), 'yyyy-MM-dd');
      this.selectedDateSubject.next(localDateString);
      return;
    }
    
    const localDateString = format(utcDate, 'yyyy-MM-dd');
    this.selectedDateSubject.next(localDateString);
  }
} 
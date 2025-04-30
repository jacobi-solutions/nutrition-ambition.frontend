import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { 
  NutritionAmbitionApiService,
  LogCoachMessageRequest,
} from './nutrition-ambition-api.service';

// Interface for a coach message
export interface CoachMessage {
  id?: string;
  accountId: string;
  foodEntryId: string;
  message: string;
  role: string;
  timestampUtc: Date;
  isRead?: boolean;
}

// Interface for request to get coach messages
export interface GetCoachMessagesRequest {
  accountId: string;
  date: string;
}

// Interface for request to clear coach messages
export interface ClearCoachMessagesRequest {
  accountId: string;
  date: string;
}

@Injectable({
  providedIn: 'root'
})
export class CoachMessageService {
  constructor(private apiService: NutritionAmbitionApiService) { }

  /**
   * Log a coach message to a food entry
   * @param accountId The account ID
   * @param foodEntryId The food entry ID
   * @param message The message text
   * @returns Observable of void (response is just success/failure)
   */
  logCoachMessage(accountId: string, foodEntryId: string, message: string): Observable<void> {
    const requestData = {
      accountId: accountId,
      foodEntryId: foodEntryId,
      message: message,
      role: 'coach',
      isAnonymousUser: false
    };

    const request = LogCoachMessageRequest.fromJS(requestData);

    return this.apiService.log(request).pipe(
      catchError(error => {
        console.error('Error logging coach message:', error);
        throw error;
      })
    );
  }

  /**
   * Load daily coach messages for a specific account and date
   * This is a stub until the backend API is implemented
   * @param accountId The account ID
   * @param date The date to get messages for
   * @returns Observable of coach messages
   */
  loadDailyCoachMessages(accountId: string, date: string): Observable<CoachMessage[]> {
    // TODO: This is a stub until the backend API is implemented
    console.warn('getCoachMessages endpoint not yet implemented in the backend');
    return of([]);
  }

  /**
   * Reset/clear coach messages for a specific account and date
   * This is a stub until the backend API is implemented
   * @param accountId The account ID
   * @param date The date to clear messages for
   * @returns Observable that resolves to true on success, false on failure
   */
  resetCoachMessages(accountId: string, date: string): Observable<boolean> {
    // TODO: This is a stub until the backend API is implemented
    console.warn('clearCoachMessages endpoint not yet implemented in the backend');
    return of(false);
  }
} 
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { NutritionAmbitionApiService, ShowRestrictedMessageRequest, ChatMessage } from './nutrition-ambition-api.service';
import { DateService } from './date.service';

export interface RestrictedAccessEvent {
  phase: string;
  redirectUrl: string;
}

@Injectable({
  providedIn: 'root'
})
export class RestrictedAccessService {
  // Subject to emit when a restricted message is shown (so chat page can display it)
  private restrictedMessageSubject = new Subject<ChatMessage[]>();
  public restrictedMessage$ = this.restrictedMessageSubject.asObservable();

  // Prevent duplicate handling when multiple 403s arrive simultaneously
  private isHandling = false;

  constructor(
    private router: Router,
    private apiService: NutritionAmbitionApiService,
    private dateService: DateService
  ) {}

  /**
   * Handles a restricted access response from the backend.
   * Navigates to chat and calls the ShowRestrictedMessage endpoint.
   */
  async handleRestrictedAccess(phase: string, redirectUrl: string): Promise<void> {
    // Skip if already handling a restricted access response
    if (this.isHandling) {
      return;
    }
    this.isHandling = true;

    console.log('[RestrictedAccessService] Handling restricted access, phase:', phase);

    try {
      // Navigate to chat page first (chat is under /app/chat due to tabs layout)
      await this.router.navigate(['/app/chat']);

      // Call the ShowRestrictedMessage endpoint to save and get the message
      const request = new ShowRestrictedMessageRequest({
        phase: phase,
        localDateKey: this.dateService.getSelectedDate()
      });

      const response = await this.apiService.showRestrictedMessage(request).toPromise();

      if (response?.isSuccess && response.messages && response.messages.length > 0) {
        // Emit the message so chat page can display it
        this.restrictedMessageSubject.next(response.messages);
      } else {
        console.error('[RestrictedAccessService] Failed to get restricted message:', response?.errors);
      }
    } catch (error) {
      console.error('[RestrictedAccessService] Error showing restricted message:', error);
    } finally {
      this.isHandling = false;
    }
  }

  /**
   * Checks if an HTTP error response is a restricted access error.
   */
  isRestrictedAccessError(error: any): boolean {
    return error?.status === 403 && error?.error?.isRestricted === true;
  }

  /**
   * Extracts restricted access info from an error response.
   */
  getRestrictedAccessInfo(error: any): RestrictedAccessEvent | null {
    if (!this.isRestrictedAccessError(error)) {
      return null;
    }

    return {
      phase: error.error.phase || '',
      redirectUrl: error.error.redirectUrl || ''
    };
  }
}

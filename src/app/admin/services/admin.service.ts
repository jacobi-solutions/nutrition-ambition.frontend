import { Injectable } from '@angular/core';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { 
  NutritionAmbitionApiService,
  GetFeedbackWithAccountInfoRequest,
  GetFeedbackWithAccountInfoResponse,
  GetUserChatMessagesRequest,
  GetUserChatMessagesResponse,
  FeedbackWithAccount,
  DeleteFeedbackRequest,
  DeleteFeedbackResponse,
  CompleteFeedbackRequest,
  CompleteFeedbackResponse,
  FeedbackEntry,
  ChatMessage,
  SearchLogsRequest,
  SearchLogsResponse,
  LogEntryDto
} from '../../services/nutrition-ambition-api.service';

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private _feedbackEntriesSubject = new BehaviorSubject<FeedbackWithAccount[]>([]);
  public feedbackEntries$ = this._feedbackEntriesSubject.asObservable();

  private _loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this._loadingSubject.asObservable();

  constructor(private apiService: NutritionAmbitionApiService) {
    console.log('[AdminService] Initialized');
  }

  /**
   * Get all feedback entries with account information and optional filtering
   */
  async getAllFeedback(filters?: {
    feedbackType?: string;
    accountId?: string;
    completedOnly?: boolean;
    incompleteOnly?: boolean;
    accountEmail?: string;
  }): Promise<GetFeedbackWithAccountInfoResponse> {
    try {
      this._loadingSubject.next(true);
      console.log('[AdminService] Loading all feedback with filters:', filters);

      const request = new GetFeedbackWithAccountInfoRequest({
        feedbackType: filters?.feedbackType,
        accountId: filters?.accountId,
        completedOnly: filters?.completedOnly || false,
        incompleteOnly: filters?.incompleteOnly || false,
        accountEmail: filters?.accountEmail
      });

      const response = await firstValueFrom(this.apiService.getFeedbackWithAccountInfo(request));
      
      if (response.isSuccess && response.feedbackWithAccounts) {
        console.log('[AdminService] Loaded feedback with account info:', response.feedbackWithAccounts.length);
        this._feedbackEntriesSubject.next(response.feedbackWithAccounts);
      } else {
        console.error('[AdminService] Failed to load feedback:', response.errors);
        this._feedbackEntriesSubject.next([]);
      }

      return response;
    } catch (error) {
      console.error('[AdminService] Error loading feedback:', error);
      this._feedbackEntriesSubject.next([]);
      throw error;
    } finally {
      this._loadingSubject.next(false);
    }
  }

  /**
   * Get a specific feedback entry by ID from current entries
   */
  getFeedbackById(feedbackId: string): FeedbackEntry | null {
    try {
      console.log('[AdminService] Finding feedback by ID:', feedbackId);
      
      const feedbackWithAccount = this.currentFeedbackEntries.find(f => f.feedback?.id === feedbackId);
      return feedbackWithAccount?.feedback || null;
    } catch (error) {
      console.error('[AdminService] Error finding feedback by ID:', error);
      return null;
    }
  }

  /**
   * Mark feedback as complete/incomplete with optional note
   */
  async completeFeedback(feedbackId: string, isCompleted: boolean, completionNote?: string): Promise<CompleteFeedbackResponse> {
    try {
      console.log('[AdminService] Updating feedback completion:', { feedbackId, isCompleted, completionNote });

      const request = new CompleteFeedbackRequest({
        feedbackId: feedbackId,
        isCompleted: isCompleted,
        completionNote: completionNote ?? ""
      });

      const response = await firstValueFrom(this.apiService.completeFeedback(request));
      
      if (response.isSuccess && response.feedbackEntry) {
        console.log('[AdminService] Feedback completion updated successfully');
        // Update the local list
        await this.refreshCurrentFeedbackList();
      } else {
        console.error('[AdminService] Failed to update feedback completion:', response.errors);
      }

      return response;
    } catch (error) {
      console.error('[AdminService] Error updating feedback completion:', error);
      throw error;
    }
  }

  // Note: Update feedback functionality not implemented in backend yet
  // async updateFeedback(...) would go here when backend support is added

  /**
   * Delete feedback entry
   */
  async deleteFeedback(feedbackId: string): Promise<DeleteFeedbackResponse> {
    try {
      console.log('[AdminService] Deleting feedback:', feedbackId);

      const request = new DeleteFeedbackRequest({
        feedbackId: feedbackId
      });

      const response = await firstValueFrom(this.apiService.deleteFeedback(request));
      
      if (response.isSuccess && response.deleted) {
        console.log('[AdminService] Feedback deleted successfully');
        // Note: UI will handle refreshing the list with current filters
      } else {
        console.error('[AdminService] Failed to delete feedback:', response.errors);
      }

      return response;
    } catch (error) {
      console.error('[AdminService] Error deleting feedback:', error);
      throw error;
    }
  }

  /**
   * Get feedback statistics from current entries (doesn't reload data)
   */
  getFeedbackStatsFromCurrent(): {
    total: number;
    completed: number;
    incomplete: number;
    byType: { [key: string]: number };
  } {
    try {
      const entries = this.currentFeedbackEntries;
      
      if (!entries || entries.length === 0) {
        return { total: 0, completed: 0, incomplete: 0, byType: {} };
      }

      const stats = {
        total: entries.length,
        completed: entries.filter(e => e.feedback?.isCompleted).length,
        incomplete: entries.filter(e => !e.feedback?.isCompleted).length,
        byType: {} as { [key: string]: number }
      };

      // Count by feedback type
      entries.forEach(entry => {
        if (entry.feedback?.feedbackType) {
          stats.byType[entry.feedback.feedbackType] = (stats.byType[entry.feedback.feedbackType] || 0) + 1;
        }
      });

      return stats;
    } catch (error) {
      console.error('[AdminService] Error getting feedback stats:', error);
      return { total: 0, completed: 0, incomplete: 0, byType: {} };
    }
  }

  /**
   * Get feedback statistics (loads data if needed)
   */
  async getFeedbackStats(): Promise<{
    total: number;
    completed: number;
    incomplete: number;
    byType: { [key: string]: number };
  }> {
    try {
      // If we don't have any entries, load them first
      if (this.currentFeedbackEntries.length === 0) {
        await this.getAllFeedback();
      }
      
      return this.getFeedbackStatsFromCurrent();
    } catch (error) {
      console.error('[AdminService] Error getting feedback stats:', error);
      return { total: 0, completed: 0, incomplete: 0, byType: {} };
    }
  }

  /**
   * Refresh the current feedback list (maintains current filters)
   */
  private async refreshCurrentFeedbackList(): Promise<void> {
    // For now, just reload all feedback
    // In a more sophisticated implementation, you could maintain current filters
    await this.getAllFeedback();
  }

  /**
   * Clear the current feedback list
   */
  clearFeedbackList(): void {
    this._feedbackEntriesSubject.next([]);
  }

  /**
   * Get current feedback entries value
   */
  get currentFeedbackEntries(): FeedbackWithAccount[] {
    return this._feedbackEntriesSubject.value;
  }

  /**
   * Get current loading state
   */
  get isLoading(): boolean {
    return this._loadingSubject.value;
  }

  /**
   * Get user chat messages for admin review
   */
  async getUserChatMessages(accountId: string, options?: {
    loggedDateUtc?: Date;
    limit?: number;
  }): Promise<GetUserChatMessagesResponse> {
    try {
      console.log('[AdminService] Getting chat messages for account:', accountId);

      const request = new GetUserChatMessagesRequest({
        accountId: accountId,
        loggedDateUtc: options?.loggedDateUtc,
        limit: options?.limit
      });

      const response = await firstValueFrom(this.apiService.getUserChatMessages(request));
      
      if (response.isSuccess && response.messages) {
        console.log('[AdminService] Retrieved', response.messages.length, 'chat messages for account', accountId);
      } else {
        console.error('[AdminService] Failed to get chat messages:', response.errors);
      }

      return response;
    } catch (error) {
      console.error('[AdminService] Error getting chat messages:', error);
      throw error;
    }
  }

  /**
   * Search system logs
   */
  async searchLogs(filters?: {
    accountId?: string;
    email?: string;
    contains?: string;
    severity?: string;
    traceId?: string;
    minutesBack?: number;
    pageSize?: number;
    pageToken?: string;
  }): Promise<SearchLogsResponse> {
    try {
      console.log('[AdminService] Searching logs with filters:', filters);

      const request = new SearchLogsRequest({
        accountId: filters?.accountId,
        email: filters?.email,
        contains: filters?.contains,
        severity: filters?.severity,
        traceId: filters?.traceId,
        minutesBack: filters?.minutesBack,
        pageSize: filters?.pageSize,
        pageToken: filters?.pageToken
      });

      const response = await firstValueFrom(this.apiService.searchLogs(request));
      
      if (response.isSuccess && response.items) {
        console.log('[AdminService] Retrieved', response.items.length, 'log entries');
      } else {
        console.error('[AdminService] Failed to search logs:', response.errors);
      }

      return response;
    } catch (error) {
      console.error('[AdminService] Error searching logs:', error);
      throw error;
    }
  }
} 
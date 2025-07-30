import { Injectable } from '@angular/core';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { 
  NutritionAmbitionApiService,
  GetFeedbackRequest,
  GetFeedbackResponse,
  SubmitUserFeedbackRequest,
  SubmitUserFeedbackResponse,
  UpdateFeedbackRequest,
  UpdateFeedbackResponse,
  DeleteFeedbackRequest,
  DeleteFeedbackResponse,
  CompleteFeedbackRequest,
  CompleteFeedbackResponse,
  FeedbackEntry
} from './nutrition-ambition-api.service';

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private _feedbackEntriesSubject = new BehaviorSubject<FeedbackEntry[]>([]);
  public feedbackEntries$ = this._feedbackEntriesSubject.asObservable();

  private _loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this._loadingSubject.asObservable();

  constructor(private apiService: NutritionAmbitionApiService) {
    console.log('[AdminService] Initialized');
  }

  /**
   * Get all feedback entries with optional filtering
   */
  async getAllFeedback(filters?: {
    feedbackType?: string;
    completedOnly?: boolean;
    incompleteOnly?: boolean;
    isCompleted?: boolean;
  }): Promise<GetFeedbackResponse> {
    try {
      this._loadingSubject.next(true);
      console.log('[AdminService] Loading all feedback with filters:', filters);

      const request = new GetFeedbackRequest({
        includeAllAccounts: true,
        feedbackType: filters?.feedbackType,
        completedOnly: filters?.completedOnly || false,
        incompleteOnly: filters?.incompleteOnly || false,
        isCompleted: filters?.isCompleted
      });

      const response = await firstValueFrom(this.apiService.getAllFeedback(request));
      
      if (response.isSuccess && response.feedbackEntries) {
        console.log('[AdminService] Loaded feedback entries:', response.feedbackEntries.length);
        this._feedbackEntriesSubject.next(response.feedbackEntries);
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
   * Get a specific feedback entry by ID
   */
  async getFeedbackById(feedbackId: string): Promise<FeedbackEntry | null> {
    try {
      console.log('[AdminService] Loading feedback by ID:', feedbackId);

      const request = new GetFeedbackRequest({
        feedbackId: feedbackId,
        includeAllAccounts: true
      });

      const response = await firstValueFrom(this.apiService.getFeedback(request));
      
      if (response.isSuccess && response.feedbackEntry) {
        console.log('[AdminService] Loaded feedback entry:', response.feedbackEntry);
        return response.feedbackEntry;
      } else {
        console.error('[AdminService] Failed to load feedback:', response.errors);
        return null;
      }
    } catch (error) {
      console.error('[AdminService] Error loading feedback by ID:', error);
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

  /**
   * Update feedback entry (for admin edits)
   */
  async updateFeedback(feedbackId: string, updates: {
    feedbackType?: string;
    message?: string;
    context?: string;
  }): Promise<UpdateFeedbackResponse> {
    try {
      console.log('[AdminService] Updating feedback:', { feedbackId, updates });

      const request = new UpdateFeedbackRequest({
        feedbackId: feedbackId,
        feedbackType: updates.feedbackType,
        message: updates.message,
        context: updates.context
      });

      const response = await firstValueFrom(this.apiService.updateFeedback(request));
      
      if (response.isSuccess && response.feedbackEntry) {
        console.log('[AdminService] Feedback updated successfully');
        // Update the local list
        await this.refreshCurrentFeedbackList();
      } else {
        console.error('[AdminService] Failed to update feedback:', response.errors);
      }

      return response;
    } catch (error) {
      console.error('[AdminService] Error updating feedback:', error);
      throw error;
    }
  }

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
        // Update the local list
        await this.refreshCurrentFeedbackList();
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
        completed: entries.filter(e => e.isCompleted).length,
        incomplete: entries.filter(e => !e.isCompleted).length,
        byType: {} as { [key: string]: number }
      };

      // Count by feedback type
      entries.forEach(entry => {
        if (entry.feedbackType) {
          stats.byType[entry.feedbackType] = (stats.byType[entry.feedbackType] || 0) + 1;
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
  get currentFeedbackEntries(): FeedbackEntry[] {
    return this._feedbackEntriesSubject.value;
  }

  /**
   * Get current loading state
   */
  get isLoading(): boolean {
    return this._loadingSubject.value;
  }
} 
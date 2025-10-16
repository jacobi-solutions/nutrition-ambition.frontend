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
  LogEntryDto,
  GetAllAccountsRequest,
  GetAllAccountsResponse,
  DeleteAccountRequest,
  DeleteAccountResponse,
  ClearAccountDataRequest,
  ClearAccountDataResponse,
  GetAccountDataCountsRequest,
  GetAccountDataCountsResponse,
  CreateBetaAccountRequest,
  CreateBetaAccountResponse,
  GenerateBetaSignInLinkRequest,
  GenerateBetaSignInLinkResponse,
  UploadGuidelineFileRequest,
  UploadGuidelineFileResponse,
  GetGuidelineFilesRequest,
  GetGuidelineFilesResponse,
  DeleteGuidelineFileRequest,
  DeleteGuidelineFileResponse,
  ErrorDto
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

      const request = new GetFeedbackWithAccountInfoRequest({
        feedbackType: filters?.feedbackType,
        accountId: filters?.accountId,
        completedOnly: filters?.completedOnly || false,
        incompleteOnly: filters?.incompleteOnly || false,
        accountEmail: filters?.accountEmail
      });

      const response = await firstValueFrom(this.apiService.getFeedbackWithAccountInfo(request));
      
      if (response.isSuccess && response.feedbackWithAccounts) {
        this._feedbackEntriesSubject.next(response.feedbackWithAccounts);
      } else {
        this._feedbackEntriesSubject.next([]);
      }

      return response;
    } catch (error) {
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
      
      const feedbackWithAccount = this.currentFeedbackEntries.find(f => f.feedback?.id === feedbackId);
      return feedbackWithAccount?.feedback || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Mark feedback as complete/incomplete with optional note
   */
  async completeFeedback(feedbackId: string, isCompleted: boolean, completionNote?: string): Promise<CompleteFeedbackResponse> {
    try {

      const request = new CompleteFeedbackRequest({
        feedbackId: feedbackId,
        isCompleted: isCompleted,
        completionNote: completionNote ?? ""
      });

      const response = await firstValueFrom(this.apiService.completeFeedback(request));
      
      if (response.isSuccess && response.feedbackEntry) {
        // Update the local list
        await this.refreshCurrentFeedbackList();
      } else {
      }

      return response;
    } catch (error) {
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

      const request = new DeleteFeedbackRequest({
        feedbackId: feedbackId
      });

      const response = await firstValueFrom(this.apiService.deleteFeedback(request));
      
      if (response.isSuccess && response.deleted) {
        // Note: UI will handle refreshing the list with current filters
      } else {
      }

      return response;
    } catch (error) {
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
    localDateKey?: string;
    limit?: number;
  }): Promise<GetUserChatMessagesResponse> {
    try {

      const request = new GetUserChatMessagesRequest({
        accountId: accountId,
        localDateKey: options?.localDateKey,
        limit: options?.limit
      });

      const response = await firstValueFrom(this.apiService.getUserChatMessages(request));
      
      if (response.isSuccess && response.messages) {
      } else {
      }

      return response;
    } catch (error) {
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
      } else {
      }

      return response;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all accounts (admin only)
   */
  async getAllAccounts(): Promise<GetAllAccountsResponse> {
    try {

      const request = new GetAllAccountsRequest();
      const response = await firstValueFrom(this.apiService.getAllAccounts(request));
      
      if (response.isSuccess && response.accounts) {
      } else {
      }

      return response;
    } catch (error) {
      const errorResponse = new GetAllAccountsResponse();
      if (!errorResponse.errors) {
        errorResponse.errors = [];
      }
      errorResponse.errors.push(new ErrorDto({ errorMessage: 'An error occurred while retrieving accounts.' }));
      return errorResponse;
    }
  }

  /**
   * Delete an account and all associated data (admin only)
   */
  async deleteAccount(accountId: string, confirmDelete: boolean = true): Promise<DeleteAccountResponse> {
    try {

      const request = new DeleteAccountRequest({
        accountId: accountId,
        confirmDelete: confirmDelete
      });

      const response = await firstValueFrom(this.apiService.deleteAccount(request));
      
      if (response.isSuccess) {
      } else {
      }

      return response;
    } catch (error) {
      const errorResponse = new DeleteAccountResponse();
      if (!errorResponse.errors) {
        errorResponse.errors = [];
      }
      errorResponse.errors.push(new ErrorDto({ errorMessage: 'An error occurred while deleting the account.' }));
      return errorResponse;
    }
  }

  /**
   * Clear all data for an account but keep the account (admin only)
   */
  async clearAccountData(accountId: string, confirmClear: boolean = true): Promise<ClearAccountDataResponse> {
    try {

      const request = new ClearAccountDataRequest({
        accountId: accountId,
        confirmClear: confirmClear
      });

      const response = await firstValueFrom(this.apiService.clearAccountData(request));
      
      if (response.isSuccess) {
      } else {
      }

      return response;
    } catch (error) {
      const errorResponse = new ClearAccountDataResponse();
      if (!errorResponse.errors) {
        errorResponse.errors = [];
      }
      errorResponse.errors.push(new ErrorDto({ errorMessage: 'An error occurred while clearing the account data.' }));
      return errorResponse;
    }
  }

  /**
   * Get data counts for an account (admin only)
   */
  async getAccountDataCounts(accountId: string): Promise<GetAccountDataCountsResponse> {
    try {

      const request = new GetAccountDataCountsRequest({
        accountId: accountId
      });

      const response = await firstValueFrom(this.apiService.getAccountDataCounts(request));
      
      if (response.isSuccess) {
      } else {
      }

      return response;
    } catch (error) {
      const errorResponse = new GetAccountDataCountsResponse();
      if (!errorResponse.errors) {
        errorResponse.errors = [];
      }
      errorResponse.errors.push(new ErrorDto({ errorMessage: 'An error occurred while retrieving account data counts.' }));
      return errorResponse;
    }
  }

  /**
   * Create a beta account with Firebase auth and generate sign-in link (admin only)
   */
  async createBetaAccount(email: string): Promise<CreateBetaAccountResponse> {
    console.log('🟣 AdminService.createBetaAccount called with email:', email);

    try {
      const request = new CreateBetaAccountRequest({
        email: email
      });
      console.log('🟣 CreateBetaAccountRequest created:', request);

      console.log('🟣 Calling apiService.createBetaAccount...');
      const response = await firstValueFrom(this.apiService.createBetaAccount(request));
      console.log('🟣 createBetaAccount response:', response);

      if (response.isSuccess) {
        console.log('🟢 Beta account created successfully');
        console.log('🟢 Sign-in link:', response.signInLink?.substring(0, 50) + '...');
      } else {
        console.log('🔴 Beta account creation failed:', response.errors);
      }

      return response;
    } catch (error) {
      console.error('🔴 Error in AdminService.createBetaAccount:', error);
      const errorResponse = new CreateBetaAccountResponse();
      if (!errorResponse.errors) {
        errorResponse.errors = [];
      }
      errorResponse.errors.push(new ErrorDto({ errorMessage: 'An error occurred while creating the beta account.' }));
      return errorResponse;
    }
  }

  /**
   * Generate a beta sign-in link for an existing account (admin only)
   */
  async generateBetaSignInLink(email: string): Promise<GenerateBetaSignInLinkResponse> {
    console.log('🟣 AdminService.generateBetaSignInLink called with email:', email);

    try {
      const request = new GenerateBetaSignInLinkRequest({
        email: email
      });
      console.log('🟣 GenerateBetaSignInLinkRequest created:', request);

      console.log('🟣 Calling apiService.generateBetaSignInLink...');
      const response = await firstValueFrom(this.apiService.generateBetaSignInLink(request));
      console.log('🟣 generateBetaSignInLink response:', response);

      if (response.isSuccess) {
        console.log('🟢 Beta sign-in link generated successfully');
        console.log('🟢 Sign-in link:', response.signInLink?.substring(0, 50) + '...');
      } else {
        console.log('🔴 Beta sign-in link generation failed:', response.errors);
      }

      return response;
    } catch (error) {
      console.error('🔴 Error in AdminService.generateBetaSignInLink:', error);
      const errorResponse = new GenerateBetaSignInLinkResponse();
      if (!errorResponse.errors) {
        errorResponse.errors = [];
      }
      errorResponse.errors.push(new ErrorDto({ errorMessage: 'An error occurred while generating the beta sign-in link.' }));
      return errorResponse;
    }
  }

  /**
   * Upload a guideline file to OpenAI
   */
  async uploadGuidelineFile(file: File): Promise<UploadGuidelineFileResponse> {
    try {
      // Read file as ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();

      // Convert to base64
      const uint8Array = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < uint8Array.byteLength; i++) {
        binary += String.fromCharCode(uint8Array[i]);
      }
      const base64Data = btoa(binary);

      const request = new UploadGuidelineFileRequest({
        fileName: file.name,
        contentType: file.type || 'application/octet-stream',
        base64Data: base64Data
      });

      const response = await firstValueFrom(this.apiService.uploadGuidelineFile(request));
      return response;
    } catch (error) {
      const errorResponse = new UploadGuidelineFileResponse();
      if (!errorResponse.errors) {
        errorResponse.errors = [];
      }
      errorResponse.errors.push(new ErrorDto({ errorMessage: 'An error occurred while uploading the file.' }));
      return errorResponse;
    }
  }

  /**
   * Get all guideline files
   */
  async getGuidelineFiles(): Promise<GetGuidelineFilesResponse> {
    try {
      const request = new GetGuidelineFilesRequest();
      const response = await firstValueFrom(this.apiService.getGuidelineFiles(request));
      return response;
    } catch (error) {
      const errorResponse = new GetGuidelineFilesResponse();
      if (!errorResponse.errors) {
        errorResponse.errors = [];
      }
      errorResponse.errors.push(new ErrorDto({ errorMessage: 'An error occurred while retrieving guideline files.' }));
      return errorResponse;
    }
  }

  /**
   * Delete a guideline file
   */
  async deleteGuidelineFile(fileId: string): Promise<DeleteGuidelineFileResponse> {
    try {
      const request = new DeleteGuidelineFileRequest({
        openAiFileId: fileId
      });

      const response = await firstValueFrom(this.apiService.deleteGuidelineFile(request));
      return response;
    } catch (error) {
      const errorResponse = new DeleteGuidelineFileResponse();
      if (!errorResponse.errors) {
        errorResponse.errors = [];
      }
      errorResponse.errors.push(new ErrorDto({ errorMessage: 'An error occurred while deleting the file.' }));
      return errorResponse;
    }
  }
}
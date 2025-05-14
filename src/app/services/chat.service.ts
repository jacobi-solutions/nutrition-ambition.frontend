import { Injectable } from '@angular/core';
import { Observable, map, catchError, throwError, of, Subject } from 'rxjs';
import { NutritionAmbitionApiService } from './nutrition-ambition-api.service';
import { AccountsService } from './accounts.service';
import { 
  GetInitialMessageRequest,
  PostLogHintRequest,
  AnonymousWarningRequest,
  LogChatMessageRequest,
  GetChatMessagesRequest,
  ClearChatMessagesRequest,
  BotMessageResponse,
  LogChatMessageResponse,
  GetChatMessagesResponse,
  ClearChatMessagesResponse,
  AssistantRunMessageRequest
} from './nutrition-ambition-api.service';

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  // Subject to emit when meals are logged
  mealLogged$ = new Subject<void>();
  
  constructor(
    private apiService: NutritionAmbitionApiService,
    private accountsService: AccountsService
  ) {}

  getFirstTimeWelcomeMessage(): string {
    return "Hi there! I'm your nutrition assistant — here to help you track your meals, understand your nutrients, and stay on track with your goals. You can start right away by telling me what you ate today — no setup needed! We can also talk about your health goals whenever you're ready. 🍎🥦";
  }

  getInitialMessage(): Observable<BotMessageResponse> {
    console.log('[DEBUG] Getting initial message from API');
    
    // Check if we already have an account ID to avoid creating duplicates
    const existingAccountId = this.accountsService.getAccountId();
    if (existingAccountId) {
      console.log('[DEBUG] Using existing account ID for initial message:', existingAccountId);
    } else {
      console.log('[DEBUG] No account ID found for initial message');
    }
    
    const request = new GetInitialMessageRequest({
      lastLoggedDate: undefined,
      hasLoggedFirstMeal: false
    });
    
    return this.apiService.getInitialMessage(request);
  }

  getAnonymousWarning(): Observable<BotMessageResponse> {
    const request = new AnonymousWarningRequest({
      lastLoggedDate: undefined,
      hasLoggedFirstMeal: false
    });
    
    return this.apiService.getAnonymousWarning(request);
  }

  getPostLogHint(hasLoggedFirstMeal: boolean): Observable<BotMessageResponse> {
    const request = new PostLogHintRequest({
      lastLoggedDate: new Date(),
      hasLoggedFirstMeal
    });
    
    return this.apiService.getPostLogHint(request);
  }

  // This method sends a message to the assistant API without any duplicate logging
  // The backend will log both the user message and assistant response
  sendMessage(message: string): Observable<BotMessageResponse> {
    console.log('[DEBUG] Sending message to assistant API (no duplicate logging):', message.substring(0, 30) + '...');
    return this.runAssistantMessage(message);
  }

  // Original method - kept for backward compatibility
  // This logs the message separately from the assistant call
  // Consider deprecating this for the above method
  logMessage(message: string, role: string = 'user', foodEntryId?: string): Observable<LogChatMessageResponse> {
    console.log(`[DEBUG] Explicitly logging message to backend - role: ${role}, message: ${message.substring(0, 30)}...`);
    const request = new LogChatMessageRequest({
      content: message,
      role,
      foodEntryId
    });
    
    return this.apiService.logChatMessage(request);
  }

  getMessageHistory(date: Date): Observable<GetChatMessagesResponse> {
    const request = new GetChatMessagesRequest({
      loggedDateUtc: date
    });
    return this.apiService.getChatMessages(request);
  }

  getMessageHistoryByDate(date: Date): Observable<GetChatMessagesResponse> {
    console.log('[DEBUG] Getting message history for date:', date);
    const request = new GetChatMessagesRequest({
      loggedDateUtc: date
    });
    return this.apiService.getChatMessagesByDate(request);
  }

  clearMessageHistory(date?: Date): Observable<ClearChatMessagesResponse> {
    const request = new ClearChatMessagesRequest({
      loggedDateUtc: date
    });
    return this.apiService.clearChatMessages(request);
  }

  runAssistantMessage(message: string): Observable<BotMessageResponse> {
    console.log('[DEBUG] Running assistant message:', message.substring(0, 30) + '...');
    const request = new AssistantRunMessageRequest({
      message,
    });
    
    return this.apiService.assistantRunMessage(request).pipe(
      map(response => {
        // Persist accountId if it's returned in the response
        // Using optional chaining and type assertion to prevent TypeScript errors
        console.log('[DEBUG] Assistant response received');
        
        // Map AssistantRunMessageResponse to BotMessageResponse
        const botResponse = new BotMessageResponse();
        botResponse.isSuccess = response.isSuccess;
        botResponse.errors = response.errors;
        botResponse.message = response.assistantMessage;
        botResponse.correlationId = response.correlationId;
        botResponse.stackTrace = response.stackTrace;

        const accountId = (response as any).accountId;
        if (accountId) {
          botResponse.accountId = accountId;
          console.log('[DEBUG] Account ID received in response:', accountId);
        }
        
        // Check if a meal was logged by looking for confirmation in the response
        if (response.isSuccess && 
            this.containsMealConfirmation(response.assistantMessage)) {
          console.log('[DEBUG] Meal logging detected, emitting mealLogged event');
          this.mealLogged$.next();
        }
        
        return botResponse;
      }),
      catchError(error => {
        console.error('Error in assistant conversation:', error);
        const errorResponse = new BotMessageResponse();
        errorResponse.isSuccess = false;
        errorResponse.message = "Sorry, I'm having trouble processing your request right now. Please try again later.";
        return of(errorResponse);
      })
    );
  }
  
  // Helper method to check if the response indicates a meal was logged
  private containsMealConfirmation(message: string | undefined): boolean {
    if (!message) return false;
    
    // Look for common phrases in the bot response that indicate a meal was logged
    const confirmationPhrases = [
      "logged",
      "added to your log",
      "saved to your log",
      "recorded",
      "tracked",
      "added the",
      "I've added",
      "I have added",
      "has been added"
    ];
    
    return confirmationPhrases.some(phrase => 
      message.toLowerCase().includes(phrase.toLowerCase())
    );
  }
} 
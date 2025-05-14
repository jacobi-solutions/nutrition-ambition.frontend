import { Injectable } from '@angular/core';
import { Observable, map, catchError, throwError, of } from 'rxjs';
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
  constructor(
    private apiService: NutritionAmbitionApiService,
    private accountsService: AccountsService
  ) {}

  getFirstTimeWelcomeMessage(): string {
    return "Hi there! I'm your nutrition assistant — here to help you track your meals, understand your nutrients, and stay on track with your goals. You can start right away by telling me what you ate today — no setup needed! We can also talk about your health goals whenever you're ready. 🍎🥦";
  }

  getInitialMessage(): Observable<BotMessageResponse> {
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

  logMessage(message: string, role: string = 'user', foodEntryId?: string): Observable<LogChatMessageResponse> {
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

  clearMessageHistory(date?: Date): Observable<ClearChatMessagesResponse> {
    const request = new ClearChatMessagesRequest({
      loggedDateUtc: date
    });
    return this.apiService.clearChatMessages(request);
  }

  runAssistantMessage(message: string): Observable<BotMessageResponse> {
    
    const request = new AssistantRunMessageRequest({
      message,
    });
    
    return this.apiService.assistantRunMessage(request).pipe(
      map(response => {
        // Persist accountId if it's returned in the response
        // Using optional chaining and type assertion to prevent TypeScript errors
        
        
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
} 
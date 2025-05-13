import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
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
  ClearChatMessagesResponse
} from './nutrition-ambition-api.service';

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  constructor(
    private apiService: NutritionAmbitionApiService,
    private accountService: AccountsService
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
} 
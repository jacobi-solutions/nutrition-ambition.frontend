import { Injectable } from '@angular/core';
import { Observable, map, catchError, throwError, of, Subject, switchMap, BehaviorSubject, finalize } from 'rxjs';
import { NutritionAmbitionApiService } from './nutrition-ambition-api.service';
import { AuthService } from './auth.service';
import { 
  GetChatMessagesRequest,
  ClearChatMessagesRequest,
  BotMessageResponse,
  GetChatMessagesResponse,
  ClearChatMessagesResponse,
  RunChatRequest,
  FocusInChatRequest,
  LearnMoreAboutRequest
} from './nutrition-ambition-api.service';
import { DateService } from './date.service';

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  // Subject to emit when meals are logged
  mealLogged$ = new Subject<void>();
  
  // Add a new BehaviorSubject to manage the context note
  private contextNoteSubject = new BehaviorSubject<string | null>(null);
  public contextNote$ = this.contextNoteSubject.asObservable();
  
  // Add a subject to emit focus in chat responses
  private focusInChatResponseSubject = new Subject<BotMessageResponse>();
  public focusInChatResponse$ = this.focusInChatResponseSubject.asObservable();
  
  constructor(
    private apiService: NutritionAmbitionApiService,
    private dateService: DateService,
  ) {}

  getFirstTimeWelcomeMessage(): string {
    return "Hi there! I'm your nutrition assistant — here to help you track your meals, understand your nutrients, and stay on track with your goals. You can start right away by telling me what you ate today — no setup needed! We can also talk about your health goals whenever you're ready. 🍎🥦";
  }

  // Send message to the assistant
  sendMessage(message: string): Observable<BotMessageResponse> {
    console.log('[DEBUG] Sending message to the assistant:', message.substring(0, 30) + '...');
    
    // Send to the assistant for processing
    // No need to log the message separately - the backend handles this
    return this.runAssistantMessage(message).pipe(
      catchError(error => {
        console.error('Error in sendMessage:', error);
        return of(new BotMessageResponse({
          isSuccess: false,
          message: "Sorry, I'm having trouble processing your message right now. Please try again later."
        }));
      })
    );
  }
  
  // Run assistant message
  runAssistantMessage(message: string): Observable<BotMessageResponse> {
    console.log('[DEBUG] Running assistant message:', message.substring(0, 30) + '...');
    const request = new RunChatRequest({
      message: message,
      loggedDateUtc: this.dateService.getSelectedDateUtc()
    });
    
    return this.apiService.runResponsesConversation(request).pipe(
      map(response => {
        console.log('[DEBUG] Assistant response received');
        
        // No need to map response properties as the API now returns BotMessageResponse directly
        const botResponse = response;
        
        // Check if a meal was logged by looking for confirmation in the response
        if (response.isSuccess && response.loggedMeal) {
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

  getMessageHistoryByDate(date: Date): Observable<GetChatMessagesResponse> {
    console.log('[DEBUG] Getting message history for date:', date);
    const request = new GetChatMessagesRequest({
      loggedDateUtc: date
    });
    return this.apiService.getChatMessages(request);
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

  // Focus on a specific topic in chat
  focusInChat(topic: string, date: Date): Observable<BotMessageResponse> {
    // Create the request to the backend
    const request = new FocusInChatRequest({
      focusText: topic,
      loggedDateUtc: date
    });
    
    // Call the API and handle the response
    return this.apiService.focusInChat(request).pipe(
      map(response => {
        // Emit a new message received event to indicate the response is complete
        if (response.isSuccess && response.message) {
          // Add the bot's response message to the chat UI
          const botMessage: any = {
            text: response.message,
            isUser: false,
            isTool: false,
            timestamp: new Date()
          };
          
          // Emit the response so the chat page can update
          this.focusInChatResponseSubject.next(response);
          
          return response;
        }
        
        return response;
      }),
      catchError(error => {
        console.error('Error focusing in chat:', error);
        return throwError(() => error);
      })
    );
  }
  
  // Learn more about a specific topic in chat
  learnMoreAbout(topic: string, date: Date): Observable<BotMessageResponse> {
    // Create the request to the backend
    const request = new LearnMoreAboutRequest({
      topic: topic,
      loggedDateUtc: date
    });
    
    // Call the API and handle the response
    return this.apiService.learnMoreAbout(request).pipe(
      map(response => {
        // Emit a new message received event to indicate the response is complete
        if (response.isSuccess && response.message) {
          // Add the bot's response message to the chat UI
          const botMessage: any = {
            text: response.message,
            isUser: false,
            isTool: false,
            timestamp: new Date()
          };
          
          // Emit the response so the chat page can update
          this.focusInChatResponseSubject.next(response);
          
          return response;
        }
        
        return response;
      }),
      catchError(error => {
        console.error('Error learning more about topic:', error);
        return throwError(() => error);
      })
    );
  }
  
  // Set a context note that will be shown in the chat UI
  public setContextNote(note: string) {
    this.contextNoteSubject.next(note);
  }
  
  public clearContextNote() {
    this.contextNoteSubject.next(null);
  }
} 
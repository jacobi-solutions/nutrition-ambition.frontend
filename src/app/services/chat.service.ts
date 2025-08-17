import { Injectable } from '@angular/core';
import { Observable, map, catchError, throwError, of, Subject, switchMap, BehaviorSubject, finalize } from 'rxjs';
import { NutritionAmbitionApiService } from './nutrition-ambition-api.service';
import { AuthService } from './auth.service';
import { 
  GetChatMessagesRequest,
  ClearChatMessagesRequest,
  ChatMessagesResponse,
  ClearChatMessagesResponse,
  RunChatRequest,
  LearnMoreAboutRequest,
  SubmitServingSelectionRequest,
  UserSelectedServing,
  ErrorDto,
  ChatMessage
} from './nutrition-ambition-api.service';
import { DateService } from './date.service';

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  // Subject to emit when meals are logged
  mealLogged$ = new Subject<void>();
  
  // Subject to emit when edit food selections are started
  editFoodSelectionStarted$ = new Subject<ChatMessage[]>();
  
  // Add a new BehaviorSubject to manage the context note
  private contextNoteSubject = new BehaviorSubject<string | null>(null);
  public contextNote$ = this.contextNoteSubject.asObservable();
  
  // Add a subject to emit focus in chat responses
  private learnMoreAboutResponseSubject = new Subject<ChatMessagesResponse>();
  public learnMoreAboutResponse$ = this.learnMoreAboutResponseSubject.asObservable();
  

  
  constructor(
    private apiService: NutritionAmbitionApiService,
    private dateService: DateService,
  ) {}

  getFirstTimeWelcomeMessage(): string {
    return "Hi there! I'm your nutrition assistant — here to help you track your meals, understand your nutrients, and stay on track with your goals. You can start right away by telling me what you ate today — no setup needed! We can also talk about your health goals whenever you're ready. 🍎🥦";
  }

  // Send message to the assistant
  sendMessage(message: string): Observable<ChatMessagesResponse> {
    console.log('[DEBUG] Sending message to the assistant:', message.substring(0, 30) + '...');
    
    // Send to the assistant for processing
    // No need to log the message separately - the backend handles this
    return this.runAssistantMessage(message).pipe(
      catchError(error => {
        console.error('Error in sendMessage:', error);
        return of(new ChatMessagesResponse({
          isSuccess: false,
          messages: []
        }));
      })
    );
  }
  
  // Run assistant message
  runAssistantMessage(message: string): Observable<ChatMessagesResponse> {
    console.log('[DEBUG] Running assistant message:', message.substring(0, 30) + '...');
    const request = new RunChatRequest({
      message: message,
      loggedDateUtc: this.dateService.getSelectedDateUtc()
    });
    
    return this.apiService.runResponsesConversation(request).pipe(
      map(response => {
        console.log('[DEBUG] Assistant response received');
        
        // No need to map response properties as the API now returns ChatMessagesResponse directly
        const botResponse = response;
        
        // Note: Meal logging events are now handled by individual service methods
        
        return botResponse;
      }),
      catchError(error => {
        console.error('Error in assistant conversation:', error);
        const errorResponse = new ChatMessagesResponse();
        errorResponse.isSuccess = false;
        errorResponse.messages = [];
        return of(errorResponse);
      })
    );
  }

  getMessageHistoryByDate(date: Date): Observable<ChatMessagesResponse> {
    console.log('[DEBUG] Getting message history for date:', date);
    const request = new GetChatMessagesRequest({
      loggedDateUtc: date
    });
    return this.apiService.getChatMessages(request);
  }
  
  getMessageHistory(date: Date): Observable<ChatMessagesResponse> {
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

  
  
  // Learn more about a specific topic in chat
  learnMoreAbout(topic: string, date: Date): Observable<ChatMessagesResponse> {
    // Create the request to the backend
    const request = new LearnMoreAboutRequest({
      topic: topic,
      loggedDateUtc: date
    });
    
    // Call the API and handle the response
    return this.apiService.learnMoreAbout(request).pipe(
      map(response => {
        // Emit a new message received event to indicate the response is complete
        if (response.isSuccess) {
          // Emit the response so the chat page can reload messages
          this.learnMoreAboutResponseSubject.next(response);
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

  // Emit an event when edit food selection is started
  public notifyEditFoodSelectionStarted(messages?: ChatMessage[]) {
    this.editFoodSelectionStarted$.next(messages || []);
  }

  // Add a method to reload messages for the current date
  loadMessages(): Observable<ChatMessagesResponse> {
    return this.getMessageHistory(this.dateService.getSelectedDateUtc());
  }
} 
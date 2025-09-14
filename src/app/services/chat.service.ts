import { Injectable } from '@angular/core';
import { Observable, map, catchError, throwError, of, Subject, switchMap, BehaviorSubject, finalize } from 'rxjs';
import { NutritionAmbitionApiService } from './nutrition-ambition-api.service';
import { AuthService } from './auth.service';
import { 
  GetChatMessagesRequest,
  ChatMessagesResponse,
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
  
  // Add pending edit state management
  private pendingEditSubject = new BehaviorSubject<{
    isLoading: boolean;
    editName?: string;
    messages?: ChatMessage[];
  } | null>(null);
  public pendingEdit$ = this.pendingEditSubject.asObservable();
  

  
  constructor(
    private apiService: NutritionAmbitionApiService,
    private dateService: DateService,
  ) {}

  getFirstTimeWelcomeMessage(): string {
    return "Hi there! I'm your nutrition assistant — here to help you track your meals, understand your nutrients, and stay on track with your goals. You can start right away by telling me what you ate today — no setup needed! We can also talk about your health goals whenever you're ready. 🍎🥦";
  }

  // Send message to the assistant
  sendMessage(message: string): Observable<ChatMessagesResponse> {
    
    // Send to the assistant for processing
    // No need to log the message separately - the backend handles this
    return this.runAssistantMessage(message).pipe(
      catchError(error => {
        return of(new ChatMessagesResponse({
          isSuccess: false,
          messages: []
        }));
      })
    );
  }
  
  // Run assistant message
  runAssistantMessage(message: string): Observable<ChatMessagesResponse> {
    const request = new RunChatRequest({
      message: message,
      localDateKey: this.dateService.getSelectedDate(),
    });
    
    return this.apiService.runResponsesConversation(request).pipe(
      map(response => {
        
        // No need to map response properties as the API now returns ChatMessagesResponse directly
        const botResponse = response;
        
        // Note: Meal logging events are now handled by individual service methods
        
        return botResponse;
      }),
      catchError(error => {
        const errorResponse = new ChatMessagesResponse();
        errorResponse.isSuccess = false;
        errorResponse.messages = [];
        return of(errorResponse);
      })
    );
  }

  getMessageHistoryByDate(localDateKey: string): Observable<ChatMessagesResponse> {
    const request = new GetChatMessagesRequest({
      localDateKey: localDateKey
    });
    return this.apiService.getChatMessages(request);
  }
  
  getMessageHistory(localDateKey: string): Observable<ChatMessagesResponse> {
    const request = new GetChatMessagesRequest({
      localDateKey: localDateKey
    });
    return this.apiService.getChatMessages(request);
  }
  

  
  
  // Learn more about a specific topic in chat
  learnMoreAbout(topic: string, localDateKey: string): Observable<ChatMessagesResponse> {
    // Create the request to the backend
    const request = new LearnMoreAboutRequest({
      topic: topic,
      localDateKey: localDateKey
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

  // Enhanced methods for edit state management
  public startPendingEdit(editName: string) {
    this.pendingEditSubject.next({
      isLoading: true,
      editName: editName
    });
  }

  public completePendingEdit(messages?: ChatMessage[]) {
    const current = this.pendingEditSubject.value;
    if (current) {
      this.pendingEditSubject.next({
        isLoading: false,
        editName: current.editName,
        messages: messages
      });
      
      // Also emit to the existing stream for backward compatibility
      this.editFoodSelectionStarted$.next(messages || []);
    }
  }

  public clearPendingEdit() {
    this.pendingEditSubject.next(null);
  }

  // Check if there's a completed pending edit
  public hasPendingEditMessages(): boolean {
    const current = this.pendingEditSubject.value;
    return !!(current && !current.isLoading && current.messages?.length);
  }

  // Get pending edit messages and clear them
  public consumePendingEditMessages(): ChatMessage[] | null {
    const current = this.pendingEditSubject.value;
    if (current && !current.isLoading && current.messages?.length) {
      this.clearPendingEdit();
      return current.messages;
    }
    return null;
  }

  // Emit an event when edit food selection is started (keeping for backward compatibility)
  public notifyEditFoodSelectionStarted(messages?: ChatMessage[]) {
    this.completePendingEdit(messages);
  }

  // Add a method to reload messages for the current date
  loadMessages(): Observable<ChatMessagesResponse> {
    return this.getMessageHistory(this.dateService.getSelectedDate());
  }
} 
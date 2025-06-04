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
  GetDailyGoalRequest,
  GetDailyGoalResponse,
  FocusInChatRequest,
  LearnMoreAboutRequest
} from './nutrition-ambition-api.service';

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
    private authService: AuthService
  ) {}

  getFirstTimeWelcomeMessage(): string {
    return "Hi there! I'm your nutrition assistant — here to help you track your meals, understand your nutrients, and stay on track with your goals. You can start right away by telling me what you ate today — no setup needed! We can also talk about your health goals whenever you're ready. 🍎🥦";
  }

  // Check if the user has daily goals and prompt them if not
  checkAndPromptForDailyGoal(requireInteraction: boolean = true): Observable<BotMessageResponse> {
    console.log('[DEBUG] Checking if user has daily goals set');
    
    // Check if user is authenticated
    if (requireInteraction && !this.authService.isAuthenticated()) {
      console.log('[DEBUG] Skipping daily goal check - not authenticated and interaction required');
      return of(new BotMessageResponse({
        isSuccess: true,
        message: undefined
      }));
    }
    
    // If not authenticated, handle anonymously
    if (!this.authService.isAuthenticated()) {
      return this.handleAnonymousGoalPrompt();
    }
    
    const request = new GetDailyGoalRequest({});
    
    return this.apiService.getDailyGoal(request).pipe(
      map(response => {
        if (!response.dailyGoal) {
          console.log('[DEBUG] No daily goal found, prompting user to set one');
          // Create a bot message response with the improved prompt
          const botResponse = new BotMessageResponse();
          botResponse.isSuccess = true;
          botResponse.message = "I noticed you haven't set up your nutrition goals yet. Setting personalized goals based on your age, sex, height, and weight can help you track your nutrition more effectively. Would you like to set them up now?";
          
          return botResponse;
        } else {
          // User already has goals, just return an empty successful response
          console.log('[DEBUG] User already has daily goals set');
          const emptyResponse = new BotMessageResponse();
          emptyResponse.isSuccess = true;
          return emptyResponse;
        }
      }),
      catchError(error => {
        console.error('Error checking daily goals:', error);
        return of(new BotMessageResponse({
          isSuccess: false,
          message: 'Unable to check your nutrition goals right now.'
        }));
      })
    );
  }
  
  // Handle users who need to sign in before setting goals
  private handleAnonymousGoalPrompt(): Observable<BotMessageResponse> {
    const message = "Setting personalized nutrition goals would help you track your diet more effectively. You'll need to create an account first to save your goals. Tap here to sign up.";
    console.log('[DEBUG] User needs to sign in to set goals, prompting sign up');
    
    // Create a response with the sign-up prompt message
    const response = new BotMessageResponse();
    response.isSuccess = true;
    response.message = message;
    
    return of(response);
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
      message,
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
    // Note: Context note is now set by the component before calling this method
    
    // Create the request to the backend
    const request = new FocusInChatRequest({
      focusText: topic,
      date: date
    });
    
    // Call the API and handle the response
    return this.apiService.focusInChat(request).pipe(
      map(response => {
        // Note: Context note is now cleared by the component based on response
        
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
          
          // Notify subscribers that a meal was logged if applicable
          if (response.loggedMeal) {
            this.mealLogged$.next();
          }
        }
        
        return response;
      }),
      catchError(error => {
        // Note: Context note is now cleared by the component on error
        console.error('Error in focus-in-chat:', error);
        return of(new BotMessageResponse({
          isSuccess: false,
          message: "Sorry, I'm having trouble focusing on that topic right now. Please try again later."
        }));
      })
    );
  }
  
  // Learn more about a specific topic
  learnMoreAbout(topic: string, date: Date): Observable<BotMessageResponse> {
    this.setContextNote(`Learning more about: ${topic}`);
    
    // Create the request to the backend
    const request = new LearnMoreAboutRequest({
      topic,
      date
    });
    
    // Call the API and handle the response
    return this.apiService.learnMoreAbout(request).pipe(
      map(response => {
        // Emit a new message received event to indicate the response is complete
        if (response.isSuccess && response.message) {
          // Emit the response so the chat page can update
          this.focusInChatResponseSubject.next(response);
          
          // Notify subscribers that a meal was logged if applicable
          if (response.loggedMeal) {
            this.mealLogged$.next();
          }
        }
        
        return response;
      }),
      catchError(error => {
        console.error('Error in learn-more-about:', error);
        return of(new BotMessageResponse({
          isSuccess: false,
          message: "Sorry, I'm having trouble providing more information about that topic right now. Please try again later."
        }));
      }),
      finalize(() => this.clearContextNote())
    );
  }

  // Add methods to manage context note
  public setContextNote(note: string) {
    this.contextNoteSubject.next(note);
  }

  public clearContextNote() {
    this.contextNoteSubject.next(null);
  }
} 
import { Component, OnInit, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonFooter, IonToolbar, IonInput, IonButton, IonIcon, IonSpinner, IonText, IonRefresher, IonRefresherContent } from '@ionic/angular/standalone';
import { AppHeaderComponent } from '../../components/header/header.component';
import { addIcons } from 'ionicons';
import { paperPlaneOutline } from 'ionicons/icons';
import { AccountsService } from '../../services/accounts.service';
import { AuthService } from '../../services/auth.service';
import { ChatService } from '../../services/chat.service';
import { DateService } from '../../services/date.service';
import { 
  BotMessageResponse,
  GetChatMessagesResponse,
  ChatMessage
} from '../../services/nutrition-ambition-api.service';
import { catchError, finalize, of, Subscription } from 'rxjs';
import { Router } from '@angular/router';
import { ChatMessageComponent } from 'src/app/components/chat-message/chat-message.component';
import { ChatFabComponent } from 'src/app/components/chat-fab/chat-fab.component';

interface DisplayMessage {
  text: string;
  isUser: boolean;
  isContextNote?: boolean; // Property to identify context note messages
  timestamp: Date;
}

@Component({
  selector: 'app-chat',
  templateUrl: './chat.page.html',
  styleUrls: ['./chat.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonContent,
    IonFooter,
    IonToolbar,
    IonInput,
    IonButton,
    IonIcon,
    IonSpinner,
    IonRefresher,
    IonRefresherContent,
    AppHeaderComponent,
    ChatMessageComponent,
    ChatFabComponent
  ]
})
export class ChatPage implements OnInit, AfterViewInit, OnDestroy {
  messages: DisplayMessage[] = [];
  userMessage: string = '';
  isLoading: boolean = false;
  isLoadingHistory: boolean = false;
  selectedDate: string = new Date().toISOString();
  error: string | null = null;
  userEmail: string | null = null;
  contextNote: string | null = null;
  private dateSubscription: Subscription;
  private contextNoteSubscription: Subscription;
  private focusInChatSubscription: Subscription;
  private hasPromptedForGoal: boolean = false;
  private hasInitialMessage: boolean = false;

  @ViewChild('content', { static: false }) content: IonContent;
  @ViewChild('messagesContent') messagesContent: ElementRef;

  constructor(
    private chatService: ChatService,
    private accountService: AccountsService,
    private authService: AuthService,
    private dateService: DateService,
    private router: Router
  ) {
    // Add the icons explicitly to the library
    addIcons({ paperPlaneOutline });
  }

  async ngOnInit() {
    // Subscribe to date changes
    this.dateSubscription = this.dateService.selectedDate$.subscribe(date => {
      this.selectedDate = date;
      this.loadChatHistory(new Date(date));
    });
    
    // Subscribe to context note changes
    this.contextNoteSubscription = this.chatService.contextNote$.subscribe(note => {
      this.contextNote = note;
      
      // Show typing indicator when a context note is set
      if (note) {
        this.isLoading = true;
        // Make sure we scroll to see the context note and typing indicator
        this.scrollToBottom();
      } else {
        // If context note is cleared without a response appearing, stop the loading indicator
        // This happens in error cases where the API call failed
        if (this.isLoading && this.messages.length > 0 && 
            !this.messages[this.messages.length - 1].isUser) {
          // Only stop loading if the last message is from the bot (meaning we got a response)
          this.isLoading = false;
        }
      }
    });
    
    // Subscribe to receive the bot's response from the focusInChat method
    this.focusInChatSubscription = this.chatService.focusInChatResponse$.subscribe(response => {
      if (response && response.isSuccess && response.message) {
        // Add the bot's response to the messages array
        this.messages.push({
          text: response.message,
          isUser: false,
          timestamp: new Date()
        });
        
        // Turn off loading indicator
        this.isLoading = false;
        
        // Clear the context note
        this.chatService.clearContextNote();
        
        // Scroll to the new message
        this.scrollToBottom();
      }
    });
    
    // Get the current user email
    this.authService.userEmail$.subscribe(email => {
      this.userEmail = email;
      
      // If a user is logged in, check if they need a daily goal prompt
      if (email && this.dateService.isToday(new Date(this.selectedDate)) && !this.hasPromptedForGoal) {
        // Only prompt for goals if the user is explicitly logged in (has email)
        // This prevents silent account creation
        this.promptForDailyGoalIfNeeded();
      }
    });
  }
  
  // Check if the user needs to set up daily goals
  private promptForDailyGoalIfNeeded(): void {
    if (this.hasPromptedForGoal) {
      return; // Avoid duplicate prompts
    }

    const accountId = this.accountService.getAccountId();
    if (!accountId) {
      return; // Only prompt logged in users
    }
    
    console.log('[DEBUG] Checking if user needs daily goal prompt');
    // Pass requireInteraction=true to prevent backend calls for users who haven't interacted
    this.chatService.checkAndPromptForDailyGoal(accountId, true).subscribe({
      next: (response: BotMessageResponse) => {
        // If the response has a message, it means we should prompt the user
        if (response.isSuccess && response.message) {
          console.log('[DEBUG] Adding daily goal prompt to chat');
          
          // Add the prompt to the UI
          this.messages.push({
            text: response.message,
            isUser: false,
            timestamp: new Date()
          });
          
          this.scrollToBottom();
          this.hasPromptedForGoal = true;
        }
      },
      error: (error) => {
        console.error('Error checking for daily goals:', error);
      }
    });
  }
  
  ngOnDestroy() {
    // Clean up subscriptions
    if (this.dateSubscription) {
      this.dateSubscription.unsubscribe();
    }
    
    if (this.contextNoteSubscription) {
      this.contextNoteSubscription.unsubscribe();
    }
    
    if (this.focusInChatSubscription) {
      this.focusInChatSubscription.unsubscribe();
    }
  }

  ngAfterViewInit() {
    console.log('[DEBUG] Chat view initialized');
    
    // Check if content is available
    if (!this.content) {
      console.warn('[WARN] IonContent reference is not available in ngAfterViewInit');
    }
    
    // Initial scroll to bottom
    this.scrollToBottom();
  }
  
  // This will be called when the component has been fully activated
  ionViewDidEnter() {
    console.log('[DEBUG] Chat view fully entered');
    // Ensure we scroll to bottom when the view is fully active
    this.scrollToBottom();
  }

  // Handle date changes from the header
  onDateChanged(newDate: string) {
    console.log(`[ChatPage] Date changed to: ${newDate}`);
    
    // Update local value first
    this.selectedDate = newDate;
    
    // Then update the service
    this.dateService.setSelectedDate(newDate);
  }
  
  // Handle navigation to previous day
  onPreviousDay() {
    console.log(`[ChatPage] Previous day clicked, current date is: ${this.selectedDate}`);
    this.dateService.goToPreviousDay();
  }
  
  // Handle navigation to next day
  onNextDay() {
    console.log(`[ChatPage] Next day clicked, current date is: ${this.selectedDate}`);
    this.dateService.goToNextDay();
  }
  
  // Handle login
  onLogin() {
    this.router.navigate(['/login']);
  }
  
  // Handle logout
  onLogout() {
    this.authService.signOutUser().then(() => {
      this.router.navigate(['/auth']);
    });
  }

  // Handle refresh from header pull-down
  onRefresh() {
    console.log('[Chat] Refresh triggered, reloading chat history');
    this.loadChatHistory(new Date(this.selectedDate));
  }

  // Handle refresh from ion-refresher
  handleRefresh(event: CustomEvent) {
    console.log('[Chat] Pull-to-refresh triggered, reloading chat history');
    this.loadChatHistory(new Date(this.selectedDate));
    
    // Complete the refresh after a short delay
    setTimeout(() => {
      (event.target as any)?.complete();
    }, 1000);
  }

  loadChatHistory(date: Date) {
    // Reset current messages
    this.messages = [];
    this.isLoadingHistory = true;
    this.error = null;
    this.hasPromptedForGoal = false; // Reset prompt flag when changing dates
    this.hasInitialMessage = false;  // Reset initial message flag
    
    console.log('[DEBUG] Loading chat history for date:', date);
    
    // Check if we have an account ID (either logged in user or anonymous user with local storage ID)
    const accountId = this.accountService.getAccountId();
    
    // For completely new users with no accountId, just show the static welcome message
    // Don't make any backend calls until they interact
    if (!accountId) {
      this.isLoadingHistory = false;
      console.log('[DEBUG] No account ID, showing welcome message in UI only without backend calls');
      const welcomeMessage = this.chatService.getFirstTimeWelcomeMessage();
      
      // Add the welcome message to UI only - don't log to backend
      this.messages.push({ 
        text: welcomeMessage, 
        isUser: false, 
        timestamp: new Date() 
      });
      
      // Need to wait for the next render cycle before scrolling
      this.scrollToBottom();
      
      this.hasInitialMessage = true;
      return;
    }

    // If we have an accountId (either logged in or anonymous), load chat history
    console.log('[DEBUG] Account ID found, loading chat history:', accountId);
    
    // Get message history for the selected date
    this.chatService.getMessageHistoryByDate(date)
      .pipe(
        catchError(error => {
          console.error('Error loading chat history:', error);
          this.error = 'Unable to load chat history. Please try again later.';
          return of(null as GetChatMessagesResponse | null);
        }),
        finalize(() => {
          this.isLoadingHistory = false;
          
          // After loading history for today, check if we need to prompt for goals
          // (only for logged-in users with an email)
          if (this.dateService.isToday(date) && this.userEmail && !this.hasPromptedForGoal) {
            // The goal check will only proceed for users who have explicitly logged in
            // requireInteraction=true is passed by default to prevent silent account creation
            this.promptForDailyGoalIfNeeded();
          }
          
          // Show the static welcome message if there are no messages and it's today's date
          if (this.messages.length === 0 && this.dateService.isToday(date) && !this.hasInitialMessage) {
            this.showStaticWelcomeMessage();
          }
          
          // Make sure to scroll to bottom after everything is loaded and rendered
          console.log('[DEBUG] Messages loaded, scrolling to appropriate position');
          this.scrollToBottom();
        })
      )
      .subscribe({
        next: (response: GetChatMessagesResponse | null) => {
          if (response && response.isSuccess && response.messages && response.messages.length > 0) {
            // Convert API messages to display messages
            console.log('[DEBUG] Received chat history, message count:', response.messages.length);
            
            // Process messages and filter to only show allowed roles
            const contextNoteMsgs: ChatMessage[] = [];
            const regularMsgs: ChatMessage[] = [];
            
            // Separate messages by role - only include User (0), Assistant (1), and ContextNote (4)
            response.messages.forEach(msg => {
              if (msg.role === 4 /* MessageRoleTypes.ContextNote */) {
                contextNoteMsgs.push(msg);
              } else if (msg.role === 0 /* MessageRoleTypes.User */ || msg.role === 1 /* MessageRoleTypes.Assistant */) {
                regularMsgs.push(msg);
              }
              // Skip Tool (2) and System (3) messages - they should not be displayed in chat
            });
            
            // Convert regular messages (User and Assistant only) to display messages
            this.messages = regularMsgs.map(msg => ({
              text: msg.content || '',
              isUser: msg.role === 0 /* MessageRoleTypes.User */,
              timestamp: msg.loggedDateUtc || new Date()
            }));
            
            // Insert context notes as display messages
            if (contextNoteMsgs.length > 0) {
              contextNoteMsgs.forEach(note => {
                // Add context notes to the messages array
                this.messages.push({
                  text: note.content || '',
                  isUser: false,
                  isContextNote: true,
                  timestamp: note.loggedDateUtc || new Date()
                });
              });
              
              // Sort all messages by timestamp to ensure correct order
              this.messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
            }
            
            // Check if any messages already contain a goal prompt
            this.hasPromptedForGoal = this.messages.some(msg => 
              !msg.isUser && 
              msg.text.includes("set up personalized nutrition goals") && 
              msg.text.includes("age, sex, height, and weight")
            );
            
            this.hasInitialMessage = true;
            
            console.log('[DEBUG] Displayed message roles:', this.messages.map(m => m.isUser ? 'User' : (m.isContextNote ? 'ContextNote' : 'Assistant')));
            
            // Scroll at the end of the next event cycle
            this.scrollToBottom();
          }
          // Don't start a conversation automatically - we'll show static message instead
        }
      });
  }

  // Display a static welcome message in the UI
  showStaticWelcomeMessage() {
    const staticMessage = "Hi there! I'm your nutrition assistant — here to help you track your meals, understand your nutrients, and stay on track with your goals. You can start right away by telling me what you ate today — no setup needed! We can also talk about your health goals whenever you're ready. 🍎🥦";
    
    console.log('[DEBUG] Showing static welcome message');
    
    this.messages.push({
      text: staticMessage,
      isUser: false,
      timestamp: new Date()
    });
    
    this.hasInitialMessage = true;
    
    // Ensure we scroll to the welcome message
    this.scrollToBottom();
  }

  sendMessage() {
    if (!this.userMessage.trim()) return;
    
    // Get message text before clearing the input
    const sentMessage = this.userMessage;
    const messageDate = new Date();
    
    // Add user message to UI
    console.log('[DEBUG] Adding user message to UI:', sentMessage);
    this.messages.push({
      text: sentMessage,
      isUser: true,
      timestamp: messageDate
    });
    
    // Clear input and show loading
    this.userMessage = '';
    this.isLoading = true;
    
    // Scroll for user's message
    this.scrollToBottom();
    
    // Use the sendMessage method - for new users this will create an account and start conversation
    console.log('[DEBUG] Sending message to backend:', sentMessage);
    this.chatService.sendMessage(sentMessage).subscribe({
      next: (response: BotMessageResponse) => {
        this.isLoading = false;
        if (response.isSuccess && response.message) {
          console.log('[DEBUG] Received bot response:', response.message);
          
          // Add the bot message to UI only (already logged on backend)
          const botMessage = {
            text: response.message,
            isUser: false,
            timestamp: new Date()
          };
          
          this.messages.push(botMessage);
          
          // Scroll for bot's message response
          this.scrollToBottom();
          
          // If this is the first message from a completely new user, the backend may have
          // created a new anonymous account - check if we got an accountId back
          if (response.accountId) {
            console.log('[DEBUG] Anonymous account created with ID:', response.accountId);
            // The accountId will be automatically persisted by the account service
          }
          
          // Check for profile and goals creation confirmation in the response
          if (response.message.includes("created your personalized nutrition goals") || 
              response.message.includes("Daily Calories") ||
              response.message.includes("I've set up your profile")) {
            console.log('[DEBUG] Profile and goals created, marking as prompted');
            this.hasPromptedForGoal = true;
          }
          
          // If this is a goals-related message, make sure we don't prompt again
          if (response.message.includes("nutrition goals") || 
              response.message.includes("health goals") ||
              response.message.includes("How old are you") ||
              response.message.includes("What is your biological sex")) {
            this.hasPromptedForGoal = true;
          }
        }
      },
      error: (error: any) => {
        this.isLoading = false;
        this.messages.push({
          text: "Sorry, I'm having trouble understanding that right now. Please try again later.",
          isUser: false,
          timestamp: new Date()
        });
        console.error('Error sending message to assistant:', error);
        
        // Scroll for error message
        this.scrollToBottom();
      }
    });
  }
  
  // Handle scroll events
  onScroll(event: any) {
    // This method can be used for implementing "load more" when scrolling up
    // For now, we just use it to enable the scroll events
  }

  private scrollToBottom() {
    console.log('[DEBUG] Scrolling to appropriate position');
    
    // Single timeout to allow DOM rendering, then handle scrolling
    setTimeout(async () => {
      if (!this.content) {
        console.warn('[WARN] No IonContent available for scrolling');
        return;
      }

      try {
        // Get viewport and last message dimensions
        const contentElement = await this.content.getScrollElement();
        const viewportHeight = contentElement.clientHeight;
        
        // Find the last message element
        const messageElements = contentElement.querySelectorAll('app-chat-message, .context-note-inline, .typing-indicator');
        
        if (messageElements.length === 0) {
          this.content.scrollToBottom(300);
          return;
        }
        
        const lastMessageElement = messageElements[messageElements.length - 1] as HTMLElement;
        const messageHeight = lastMessageElement.offsetHeight;
        
        console.log('[DEBUG] Viewport:', viewportHeight, 'Message height:', messageHeight);
        
        // If message is taller than 40% of viewport, position it near the top
        if (messageHeight > viewportHeight * 0.4) {
          console.log('[DEBUG] Long message - positioning at top');
          
          const marginFromTop = viewportHeight * 0.05; // 5% margin from top
          const messageOffsetTop = lastMessageElement.offsetTop;
          const scrollPosition = Math.max(0, messageOffsetTop - marginFromTop);
          
          await this.content.scrollToPoint(0, scrollPosition, 300);
        } else {
          console.log('[DEBUG] Short message - scrolling to bottom');
          this.content.scrollToBottom(300);
        }
        
      } catch (error) {
        console.warn('[WARN] Smart scroll failed, using fallback:', error);
        this.content.scrollToBottom(300);
      }
    }, 250); // Single 250ms delay for DOM rendering
  }
} 
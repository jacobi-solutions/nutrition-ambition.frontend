import { Component, OnInit, ViewChild, ElementRef, AfterViewInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonFab, IonFabButton, IonFabList, IonContent, IonFooter, IonIcon, IonSpinner, IonText, IonRefresher, IonRefresherContent, AnimationController } from '@ionic/angular/standalone';
import { AppHeaderComponent } from '../../components/header/header.component';
import { addIcons } from 'ionicons';
import { addOutline, barcodeSharp, camera, closeCircleOutline, create, paperPlaneSharp } from 'ionicons/icons';
import { AuthService } from '../../services/auth.service';
import { ChatService } from '../../services/chat.service';
import { DateService } from '../../services/date.service';
import { 
  BotMessageResponse,
  GetChatMessagesResponse,
  ChatMessage,
  MessageRoleTypes,
  RankedFatSecretFood
} from '../../services/nutrition-ambition-api.service';
import { catchError, finalize, of, Subscription } from 'rxjs';
import { Router } from '@angular/router';
import { ChatMessageComponent } from 'src/app/components/chat-message/chat-message.component';
import { FoodSelectionComponent, UserSelectedServingRequest } from 'src/app/components/food-selection/food-selection.component';
import { format } from 'date-fns';

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
    IonIcon,
    IonSpinner,
    IonRefresher,
    IonRefresherContent,
    AppHeaderComponent,
    ChatMessageComponent,
    FoodSelectionComponent
  ]
})
export class ChatPage implements OnInit, AfterViewInit, OnDestroy {
  private animationCtrl = inject(AnimationController);
  isOpen = false;
  messages: DisplayMessage[] = [];
  userMessage: string = '';
  isLoading: boolean = false;
  isLoadingHistory: boolean = false;
  // Local date only — uses 'yyyy-MM-dd' format
  // UTC conversion handled via dateService when communicating with backend
  selectedDate: string = format(new Date(), 'yyyy-MM-dd');
  error: string | null = null;
  userEmail: string | null = null;
  contextNote: string | null = null;
  private dateSubscription: Subscription;
  private contextNoteSubscription: Subscription;
  private learnMoreAboutSubscription: Subscription;

  private hasInitialMessage: boolean = false;

  // Properties for handling food selection payloads
  activePayload: Record<string, RankedFatSecretFood[]>  | null = null;



  @ViewChild('content', { static: false }) content: IonContent;
  @ViewChild('messagesContent') messagesContent: ElementRef;
  @ViewChild('messageInput', { static: false }) messageInput: ElementRef<HTMLTextAreaElement>;

  constructor(
    private chatService: ChatService,
    private authService: AuthService,
    private dateService: DateService,
    private router: Router
  ) {
    // Add the icons explicitly to the library
    addIcons({
      paperPlaneSharp,
      camera,
      create,
      barcodeSharp,
      addOutline,
      closeCircleOutline
    });
  }

  async ngOnInit() {
    // Subscribe to date changes
    this.dateSubscription = this.dateService.selectedDate$.subscribe(date => {
      this.selectedDate = date;
      this.loadChatHistory(this.dateService.getSelectedDateUtc());
    });
    
    // Subscribe to context note changes
    this.contextNoteSubscription = this.chatService.contextNote$.subscribe(note => {
      this.contextNote = note;
      
      if (note) {
        // Remove any existing context note from messages
        this.messages = this.messages.filter(msg => !msg.isContextNote);
        
        // Add the new context note to the messages array with current timestamp
        this.messages.push({
          text: note,
          isUser: false,
          isContextNote: true,
          timestamp: new Date()
        });
        
        // Show typing indicator when a context note is set
        this.isLoading = true;
        
        // Scroll to see the context note and typing indicator
        this.scrollToBottom();
      }
    });
    
    // Subscribe to receive the bot's response from the focusInChat method
    this.learnMoreAboutSubscription = this.chatService.learnMoreAboutResponse$.subscribe(response => {
      if (response && response.isSuccess && response.message) {
        // Add the bot's response to the messages array
        this.messages.push({
          text: response.message,
          isUser: false,
          timestamp: new Date()
        });
        
        // Turn off loading indicator
        this.isLoading = false;
        
        // Scroll to the new message
        this.scrollToBottom();
        
        // Focus the input after response is posted
        this.focusInput();
      }
    });
    
    // Get the current user email
    this.authService.userEmail$.subscribe(email => {
      this.userEmail = email;
      

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
    
    if (this.learnMoreAboutSubscription) {
      this.learnMoreAboutSubscription.unsubscribe();
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
    this.loadChatHistory(this.dateService.getSelectedDateUtc());
  }

  // Handle refresh from ion-refresher
  handleRefresh(event: CustomEvent) {
    console.log('[Chat] Pull-to-refresh triggered, reloading chat history');
    this.loadChatHistory(this.dateService.getSelectedDateUtc());
    
    // Complete the refresh after a short delay
    setTimeout(() => {
      (event.target as any)?.complete();
    }, 1000);
  }

  async loadChatHistory(date: Date) {
    // Preserve any existing context note
    const existingContextNote = this.messages.find(msg => msg.isContextNote);
    
    // Reset current messages
    this.messages = [];
    this.isLoadingHistory = true;
    this.error = null;

    this.hasInitialMessage = false;  // Reset initial message flag
    
    console.log('[DEBUG] Loading chat history for date:', date);
    
    // Check if user is authenticated via Firebase Auth
    const isAuthenticated = await this.authService.isAuthenticated();
    
    // For users who aren't authenticated yet, just show the static welcome message
    // Don't make any backend calls until they're authenticated
    if (!isAuthenticated) {
      this.isLoadingHistory = false;
      console.log('[DEBUG] Not authenticated, showing welcome message in UI only without backend calls');
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

    // If user is authenticated, load chat history
    console.log('[DEBUG] User is authenticated, loading chat history');
    
    // Get message history for the selected date - auth token is added by AuthInterceptor
    this.chatService.getMessageHistoryByDate(date)
      .pipe(
        catchError(error => {
          console.error('Error loading chat history:', error);
          this.error = 'Unable to load chat history. Please try again later.';
          return of(null as GetChatMessagesResponse | null);
        }),
        finalize(() => {
          this.isLoadingHistory = false;
          
          // Restore existing context note if it existed and no messages were loaded
          if (this.messages.length === 0 && existingContextNote) {
            this.messages.push(existingContextNote);
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
              if (msg.role ===  MessageRoleTypes.ContextNote /* MessageRoleTypes.ContextNote */) {
                contextNoteMsgs.push(msg);
              } else if (msg.role === MessageRoleTypes.User /* MessageRoleTypes.User */ || msg.role === MessageRoleTypes.Assistant /* MessageRoleTypes.Assistant */) {
                regularMsgs.push(msg);
              }
              // Skip Tool (2) and System (3) messages - they should not be displayed in chat
            });
            
            // Convert regular messages (User and Assistant only) to display messages
            this.messages = regularMsgs.map(msg => ({
              text: msg.content || '',
              isUser: msg.role === MessageRoleTypes.User /* MessageRoleTypes.User */,
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
            }
            
            // Restore existing context note if it existed (for current real-time context)
            if (existingContextNote) {
              this.messages.push(existingContextNote);
            }
            
            // Sort all messages by timestamp to ensure correct order
            this.messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
            

            
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
    
    // Reset textarea height
    if (this.messageInput && this.messageInput.nativeElement) {
      this.messageInput.nativeElement.style.height = 'auto';
    }
    
    // Scroll for user's message
    this.scrollToBottom();
    
    // Send the message - authentication token will be added by the AuthInterceptor
    console.log('[DEBUG] Sending message to backend:', sentMessage);
    this.chatService.sendMessage(sentMessage).subscribe({
      next: (response: BotMessageResponse) => {
        this.isLoading = false;

        if (
          response.terminateEarlyForUserInput &&
          response.rankedFoodOptions &&
          Object.keys(response.rankedFoodOptions).length > 0
        ) {
          this.activePayload = response.rankedFoodOptions;
          return;
        }

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
          
          // Focus the input after response is posted
          this.focusInput();
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
        
        // Focus the input after error message is posted
        this.focusInput();
      }
    });
  }
  
  // Handle keydown events for textarea
  onKeyDown(event: KeyboardEvent) {
    // Send message on Enter key if Shift is not pressed
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault(); // Prevent new line
      this.sendMessage();
    }
  }
  
  // Handle textarea input to auto-grow the height
  onTextareaInput(event: Event) {
    const textarea = event.target as HTMLTextAreaElement;
    this.adjustTextareaHeight(textarea);
  }
  
  // Adjust textarea height based on content
  private adjustTextareaHeight(textarea: HTMLTextAreaElement) {
    // Reset height to auto to get the actual scrollHeight
    textarea.style.height = 'auto';
    
    // Calculate new height based on scroll height
    const minHeight = 16; // 1rem in pixels (approximately)
    const lineHeight = 19.2; // 1.2 * 16px font size
    const maxLines = 8; // Maximum of 8 lines
    const maxHeight = minHeight + (lineHeight * (maxLines - 1));
    
    let newHeight = Math.max(minHeight, textarea.scrollHeight);
    newHeight = Math.min(newHeight, maxHeight);
    
    textarea.style.height = newHeight + 'px';
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

  toggleFab() {
    this.isOpen = !this.isOpen;
  }

  handleAction(action: 'photo' | 'barcode' | 'edit') {
    console.log(`FAB action clicked: ${action}`);
    
    // Here we would implement the actual functionality
    switch(action) {
      case 'photo':
        console.log('Opening camera...');
        break;
      case 'barcode':
        console.log('Opening barcode scanner...');
        break;
      case 'edit':
        console.log('Opening manual entry...');
        break;
    }
    
    // Close the FAB after action is clicked
    setTimeout(() => {
      this.isOpen = false;
    }, 300);
  }

  // Focus the input element
  private focusInput() {
    // Use setTimeout to ensure the DOM has updated after scrolling
    setTimeout(() => {
      if (this.messageInput && this.messageInput.nativeElement) {
        this.messageInput.nativeElement.focus();
      }
    }, 350); // Slightly longer than scroll animation (300ms)
  }

  onFoodSelectionConfirmed(selections: UserSelectedServingRequest[]) {
    console.log('[DEBUG] Selection confirmed:', selections);
    this.chatService.submitServingSelection('TODO-message-id', selections);

    this.activePayload = null;

    this.messages.push({
      text: 'Selection confirmed ✅',
      isUser: false,
      timestamp: new Date()
    });

    this.scrollToBottom();
  }
} 
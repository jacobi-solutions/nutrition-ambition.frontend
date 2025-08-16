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
  SelectableFoodMatch,
    SubmitServingSelectionRequest,
    SubmitServingSelectionResponse,
    CancelServingSelectionRequest
} from '../../services/nutrition-ambition-api.service';
import { catchError, finalize, of, Subscription } from 'rxjs';
import { Router } from '@angular/router';
import { ChatMessageComponent } from 'src/app/components/chat-message/chat-message.component';
import { FoodSelectionComponent } from 'src/app/components/food-selection/food-selection.component';
import { format } from 'date-fns';
import { ToastService } from '../../services/toast.service';
import { FoodSelectionService } from 'src/app/services/food-selection.service';

interface DisplayMessage {
  id?: string;
  text: string;
  isUser: boolean;
  isContextNote?: boolean; // Property to identify context note messages
  timestamp: Date;
  foodOptions?: Record<string, SelectableFoodMatch[]> | null; // Add foodOptions property
  mealName?: string | null;
  role?: MessageRoleTypes;
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
  MessageRoleTypes = MessageRoleTypes;
  private animationCtrl = inject(AnimationController);
  isOpen = false;
  messages: DisplayMessage[] = [];
  userMessage: string = '';
  isLoading: boolean = false;
  isLoadingHistory: boolean = false;
  private readonly draftStorageKey: string = 'na.chat.draftMessage';
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

  @ViewChild('content', { static: false }) content: IonContent;
  @ViewChild('messagesContent') messagesContent: ElementRef;
  @ViewChild('messageInput', { static: false }) messageInput: ElementRef<HTMLTextAreaElement>;

  constructor(
    private chatService: ChatService,
    private foodSelectionService: FoodSelectionService,
    private authService: AuthService,
    private dateService: DateService,
    private router: Router,
    private toastService: ToastService
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

    // Restore any saved draft message
    const savedDraft = localStorage.getItem(this.draftStorageKey);
    if (savedDraft) {
      this.userMessage = savedDraft;
    }
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

    // Adjust textarea height if there is a restored draft
    if (this.messageInput?.nativeElement && this.userMessage) {
      this.adjustTextareaHeight(this.messageInput.nativeElement);
    }
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
            
            // Separate messages by role - only include User (0), Assistant (1), ContextNote (4), PendingFoodSelection (5), and CompletedFoodSelection (6)
            response.messages.forEach(msg => {
              if (msg.role === MessageRoleTypes.ContextNote) {
                contextNoteMsgs.push(msg);
              } else if (
                msg.role === MessageRoleTypes.User || 
                msg.role === MessageRoleTypes.Assistant || 
                msg.role === MessageRoleTypes.PendingFoodSelection ||
                msg.role === MessageRoleTypes.CompletedFoodSelection
              ) {
                regularMsgs.push(msg);
              }
              // Skip Tool (2) and System (3) messages - they should not be displayed in chat
            });
            
            // Convert regular messages (User, Assistant, and PendingFoodSelection) to display messages
            this.messages = regularMsgs.map(msg => ({
              id: msg.id,
              text: msg.content || '',
              isUser: msg.role === MessageRoleTypes.User,
              timestamp: msg.createdDateUtc || new Date(),
              foodOptions: msg.logMealToolResponse?.selectableFoodMatches || null,
              mealName: msg.logMealToolResponse?.mealName || null,
              role: msg.role
            }));
            
            // Insert context notes as display messages
            if (contextNoteMsgs.length > 0) {
              contextNoteMsgs.forEach(note => {
                // Add context notes to the messages array
                this.messages.push({
                  text: note.content || '',
                  isUser: false,
                  isContextNote: true,
                  timestamp: note.createdDateUtc || new Date()
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

  async sendMessage() {
    if (!this.userMessage.trim()) return;

    // Check authentication BEFORE removing text from the input
    const isAuthenticated = await this.authService.isAuthenticated();
    if (!isAuthenticated) {
      // Persist draft so it's available after login navigation
      localStorage.setItem(this.draftStorageKey, this.userMessage);
      await this.toastService.showToast({ message: 'Please sign in to send your message.', color: 'primary' });
      try { this.authService.setLastAttemptedRoute(this.router.url); } catch {}
      this.router.navigate(['/login']);
      return;
    }
    
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
    
    // Remove any persisted draft and clear input. Then show loading
    localStorage.removeItem(this.draftStorageKey);
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

        // Check if response has food selection requirement
        if (
          response.terminateEarlyForUserInput &&
          response.logMealToolResponse?.selectableFoodMatches &&
          Object.keys(response.logMealToolResponse.selectableFoodMatches).length > 0
        ) {
          // Create a new assistant message with food options
          
          const foodSelectionMessage: DisplayMessage = {
            id: response.logMealToolResponse?.pendingMessageId || '',
            text: response.message || 'Please confirm your food selections:',
            isUser: false,
            timestamp: new Date(),
            foodOptions: response.logMealToolResponse?.selectableFoodMatches || null,
            mealName: response.logMealToolResponse?.mealName || null,
            role: MessageRoleTypes.PendingFoodSelection
          };
          console.log('Pushing food selection message:', foodSelectionMessage);
          this.messages.push(foodSelectionMessage);
          this.scrollToBottom();
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
  onKeyDown(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      this.sendMessage();
    }
  }
  
  // Handle textarea input to auto-grow the height
  onTextareaInput(event: Event) {
    const textarea = event.target as HTMLTextAreaElement;
    this.adjustTextareaHeight(textarea);

    // Persist draft on every input change so it's never lost on navigation
    const value = textarea.value || '';
    if (value.trim().length > 0) {
      localStorage.setItem(this.draftStorageKey, value);
    } else {
      localStorage.removeItem(this.draftStorageKey);
    }
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

  private async showErrorToast(message: string) {
    await this.toastService.showToast({ message, color: 'danger' });
  }

  // Handle food selection confirmation for standalone food selection components
  onFoodSelectionConfirmed(request: SubmitServingSelectionRequest): void {
    console.log('Food selections confirmed:', request);

    const toDisplayMessage = (msg: ChatMessage): DisplayMessage => ({
      id: msg.id,
      text: msg.content || '',
      isUser: msg.role === MessageRoleTypes.User,
      timestamp: msg.loggedDateUtc || new Date(),
      foodOptions: msg.logMealToolResponse?.selectableFoodMatches || null,
      mealName: msg.logMealToolResponse?.mealName || null,
      role: msg.role
    });

    this.foodSelectionService.submitServingSelection(request).subscribe({
      next: (response: SubmitServingSelectionResponse) => {
        if (!response.isSuccess) {
          console.warn('Selection submission failed:', response.errors);
          this.showErrorToast('Failed to log food selection.');
          return;
        }

        if (response.updatedSelectionMessage && response.updatedSelectionMessage.id) {
          const idx = this.messages.findIndex(m => m.id === response.updatedSelectionMessage!.id);
          if (idx !== -1) {
            this.messages[idx] = toDisplayMessage(response.updatedSelectionMessage);
          }
        }

        if (response.newAssistantMessage) {
          this.messages.push(toDisplayMessage(response.newAssistantMessage));
        }

        this.scrollToBottom();
      },
      error: (error) => {
        console.error('Error submitting food selections:', error);
        this.showErrorToast('Failed to log food selection.');
      }
    });
  }

  // Handle food selection cancellation
  onCancelFoodSelection(message: DisplayMessage): void {
    if (!message.id) {
      console.warn('Cannot cancel food selection: message has no ID');
      return;
    }

    console.log('Canceling food selection for message:', message.id);

    // Remove the pending food selection message from UI
    const messageIndex = this.messages.findIndex(m => m.id === message.id);
    if (messageIndex !== -1) {
      this.messages.splice(messageIndex, 1);
    }

    // Set context note and show typing indicator
    this.chatService.setContextNote('Canceled food logging');
    
    // Create request and call FoodSelectionService directly
    const request = new CancelServingSelectionRequest({
      pendingMessageId: message.id,
      loggedDateUtc: this.dateService.getSelectedDateUtc()
    });
    
    // Make API call using FoodSelectionService
    this.foodSelectionService.cancelFoodLogging(request).subscribe({
      next: (response) => {
        if (!response.isSuccess) {
          console.warn('Cancel food logging failed:', response.errors);
          this.showErrorToast('Failed to cancel food selection.');
          
          // Restore the pending food selection message if cancellation failed
          if (messageIndex !== -1) {
            this.messages.splice(messageIndex, 0, message);
          }
          // Turn off loading indicator
          this.isLoading = false;
          return;
        }

        // Add the bot's response message if successful
        if (response.message) {
          this.messages.push({
            text: response.message,
            isUser: false,
            timestamp: new Date()
          });
        }
        
        // Turn off loading indicator
        this.isLoading = false;
        
        // Scroll to the new message
        this.scrollToBottom();
        
        // Focus the input after response is posted
        this.focusInput();
      },
      error: (error) => {
        console.error('Error canceling food selection:', error);
        this.showErrorToast('Failed to cancel food selection.');
        
        // Restore the pending food selection message if cancellation failed
        if (messageIndex !== -1) {
          this.messages.splice(messageIndex, 0, message);
        }
        
        // Turn off loading indicator
        this.isLoading = false;
      }
    });
  }
} 
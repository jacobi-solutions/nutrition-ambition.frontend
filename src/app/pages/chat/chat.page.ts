import { Component, OnInit, ViewChild, ElementRef, AfterViewInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonFab, IonFabButton, IonFabList, IonContent, IonFooter, IonIcon, IonSpinner, IonText, IonRefresher, IonRefresherContent, AnimationController } from '@ionic/angular/standalone';
import { ViewWillEnter } from '@ionic/angular';
import { AppHeaderComponent } from '../../components/header/header.component';
import { addIcons } from 'ionicons';
import { addOutline, barcodeSharp, camera, closeCircleOutline, create, paperPlaneSharp } from 'ionicons/icons';
import { AuthService } from '../../services/auth.service';
import { ChatService } from '../../services/chat.service';
import { DateService } from '../../services/date.service';
import { DisplayMessage } from '../../models/display-message';
import { 
  ChatMessagesResponse,
  ChatMessage,
  MessageRoleTypes,
  ComponentMatch,
    SubmitServingSelectionRequest,
    CancelServingSelectionRequest,
    CancelEditSelectionRequest,
    SubmitEditServingSelectionRequest,
    LogMealToolResponse,
    UserSelectedServing,
    SearchFoodPhraseRequest
} from '../../services/nutrition-ambition-api.service';
import { catchError, finalize, of, Subscription } from 'rxjs';
import { Router } from '@angular/router';
import { ChatMessageComponent } from 'src/app/components/chat-message/chat-message.component';
import { FoodSelectionComponent } from 'src/app/components/food-selection/food-selection.component';
import { format } from 'date-fns';
import { ToastService } from '../../services/toast.service';
import { FoodSelectionService } from 'src/app/services/food-selection.service';
import { AnalyticsService } from '../../services/analytics.service';



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
export class ChatPage implements OnInit, AfterViewInit, OnDestroy, ViewWillEnter {
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
  private editFoodSelectionStartedSubscription: Subscription;

  private hasInitialMessage: boolean = false;
  private cancelledMessageIds: Set<string> = new Set();

  @ViewChild('content', { static: false }) content: IonContent;
  @ViewChild('messagesContent') messagesContent: ElementRef;
  @ViewChild('messageInput', { static: false }) messageInput: ElementRef<HTMLTextAreaElement>;

  constructor(
    public chatService: ChatService, // Make public for template access
    private foodSelectionService: FoodSelectionService,
    private authService: AuthService,
    private dateService: DateService,
    private router: Router,
    private toastService: ToastService,
    private cdr: ChangeDetectorRef,
    private analytics: AnalyticsService // Firebase Analytics tracking
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
      this.loadChatHistory(this.dateService.getSelectedDate());
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
        
        // Check for pending edit state to show appropriate loading indicator
        this.chatService.pendingEdit$.subscribe(pendingEdit => {
          if (pendingEdit?.isLoading) {
            this.isLoading = true;
          } else if (pendingEdit?.messages?.length) {
            // If there are completed edit messages, process them
            this.processAndAddNewMessages(pendingEdit.messages);
            this.chatService.clearPendingEdit();
            this.isLoading = false;
          } else {
            // Default behavior for non-edit context notes
            this.isLoading = true;
          }
        }).unsubscribe(); // Use unsubscribe immediately since this is a one-time check
        
        // Scroll to see the context note and typing indicator
        this.scrollToBottom();
      }
    });
    
    // Subscribe to receive the bot's response from the focusInChat method
    this.learnMoreAboutSubscription = this.chatService.learnMoreAboutResponse$.subscribe(response => {
      if (response && response.isSuccess) {
        // Process the returned messages and add them to the chat
        if (response.messages && response.messages.length > 0) {
          this.processAndAddNewMessages(response.messages);
        }
        
        // Turn off loading indicator
        this.isLoading = false;
        
        // Focus the input after response is processed
        setTimeout(() => this.focusInput(), 300);
      }
    });
    
    // Subscribe to edit food selection started events to process returned messages
    this.editFoodSelectionStartedSubscription = this.chatService.editFoodSelectionStarted$.subscribe((messages) => {
      console.log('[DEBUG] Edit food selection started, processing returned messages');
      // Only process if we're currently viewing today's date (edit operations always happen on today)
      const today = format(new Date(), 'yyyy-MM-dd');
      if (this.selectedDate === today && messages && messages.length > 0) {
        this.processAndAddNewMessages(messages);
      }
      
      // Turn off loading indicator
      this.isLoading = false;
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
    
    if (this.editFoodSelectionStartedSubscription) {
      this.editFoodSelectionStartedSubscription.unsubscribe();
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
  
  // This will be called when the view is about to enter
  ionViewWillEnter() {
    // Firebase Analytics: Track page view when entering the page
    this.analytics.trackPageView('Chat');
    
    // Check for completed pending edits when entering the chat page
    const pendingMessages = this.chatService.consumePendingEditMessages();
    if (pendingMessages && pendingMessages.length > 0) {
      console.log('[DEBUG] Processing pending edit messages on view enter');
      
      // Filter out pending edit messages - only process completed edit messages
      const completedMessages = pendingMessages.filter(msg => 
        msg.role !== MessageRoleTypes.PendingEditFoodSelection
      );
      
      if (completedMessages.length > 0) {
        console.log('[DEBUG] Processing', completedMessages.length, 'completed edit messages');
        // Only process if we're currently viewing today's date (edit operations always happen on today)
        const today = format(new Date(), 'yyyy-MM-dd');
        if (this.selectedDate === today) {
          this.processAndAddNewMessages(completedMessages);
        }
      } else {
        console.log('[DEBUG] No completed edit messages to process, all were pending');
      }
      this.isLoading = false;
    }
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
      this.router.navigate(['/login']);
    });
  }

  // Handle refresh from header
  onRefresh(event?: CustomEvent) {
    console.log('[Chat] Refresh triggered, reloading chat history');
    this.loadChatHistory(this.dateService.getSelectedDate());
    
    // Complete the refresher if event is provided
    if (event && event.target) {
      setTimeout(() => {
        (event.target as any)?.complete();
      }, 1000);
    }
  }

  async loadChatHistory(localDateKey: string) {
    // Preserve any existing context note
    const existingContextNote = this.messages.find(msg => msg.isContextNote);
    
    // Reset current messages and clear cancelled message IDs for new date
    this.messages = [];
    this.cancelledMessageIds.clear();
    this.isLoadingHistory = true;
    this.error = null;

    this.hasInitialMessage = false;  // Reset initial message flag
    
    console.log('[DEBUG] Loading chat history for date:', localDateKey);
    
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
    this.chatService.getMessageHistoryByDate(localDateKey)
      .pipe(
        catchError(error => {
          console.error('Error loading chat history:', error);
          this.error = 'Unable to load chat history. Please try again later.';
          return of(null as ChatMessagesResponse | null);
        }),
        finalize(() => {
          this.isLoadingHistory = false;
          

          
          // Restore existing context note if it existed and no messages were loaded
          if (this.messages.length === 0 && existingContextNote) {
            this.messages.push(existingContextNote);
          }
          
          // Show the static welcome message if there are no messages and it's today's date
          if (this.messages.length === 0 && localDateKey === this.dateService.getSelectedDate() && !this.hasInitialMessage) {
            this.showStaticWelcomeMessage();
          }
          
          // Make sure to scroll to bottom after everything is loaded and rendered
          console.log('[DEBUG] Messages loaded, scrolling to appropriate position');
          this.scrollToBottom();
        })
      )
      .subscribe({
        next: (response: ChatMessagesResponse | null) => {
          if (response && response.isSuccess && response.messages && response.messages.length > 0) {
            // Convert API messages to display messages
            console.log('[DEBUG] Received chat history, message count:', response.messages.length);
            
            // Process messages and filter to only show allowed roles
            const contextNoteMsgs: ChatMessage[] = [];
            const regularMsgs: ChatMessage[] = [];
            
            // Separate messages by role - only include User (0), Assistant (1), ContextNote (4), PendingFoodSelection (5), CompletedFoodSelection (6), PendingEditFoodSelection (8), and CompletedEditFoodSelection (9)
            response.messages.forEach(msg => {
              if (msg.role === MessageRoleTypes.ContextNote) {
                contextNoteMsgs.push(msg);
              } else if (
                msg.role === MessageRoleTypes.User || 
                msg.role === MessageRoleTypes.Assistant || 
                msg.role === MessageRoleTypes.PendingFoodSelection ||
                msg.role === MessageRoleTypes.CompletedFoodSelection ||
                msg.role === MessageRoleTypes.PendingEditFoodSelection ||
                msg.role === MessageRoleTypes.CompletedEditFoodSelection
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
              // foodOptions removed - use logMealToolResponse.foods instead
              mealName: msg.logMealToolResponse?.mealName || null,
              logMealToolResponse: msg.logMealToolResponse || null,
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
      await this.toastService.showToast({ message: 'Please sign in to send your message.', color: 'medium' });
      try { this.authService.setLastAttemptedRoute(this.router.url); } catch {}
      this.router.navigate(['/login']);
      return;
    }
    
    // Get message text before clearing the input
    const sentMessage = this.userMessage;
    const messageDate = new Date();
    
    // Track analytics for message sending
    this.analytics.trackChatMessageSent(sentMessage.length);
    
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
      next: (response: ChatMessagesResponse) => {
        this.isLoading = false;

        if (response.isSuccess) {
          console.log('[DEBUG] Message sent successfully, processing returned messages');
          
          // Firebase Analytics: Track successful message sent
          this.analytics.trackChatMessageSent(sentMessage.length);
          
          this.analytics.trackPageView('Chat');
          
          // Process the returned messages and add them to the chat
          if (response.messages && response.messages.length > 0) {
            this.processAndAddNewMessages(response.messages);
          } else {
            console.log('[DEBUG] No messages returned in response');
          }
          
          // Only focus the input if response doesn't contain pending food selection messages
          // This prevents mobile keyboard from opening when user needs to interact with food selection cards
          if (!this.containsPendingFoodSelection(response.messages)) {
            setTimeout(() => this.focusInput(), 300);
          }
        } else {
          console.warn('Message sending failed:', response.errors);
          this.messages.push({
            text: "Sorry, I'm having trouble understanding that right now. Please try again later.",
            isUser: false,
            timestamp: new Date()
          });
          this.scrollToBottom();
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
    // Track FAB toggle analytics
    this.analytics.trackFabToggle(this.isOpen);
  }

  handleAction(action: 'photo' | 'barcode' | 'edit') {
    console.log(`FAB action clicked: ${action}`);
    
    // Determine if the action is implemented
    const implementedActions = ['edit']; // Only manual entry is currently working
    const isImplemented = implementedActions.includes(action);
    
    // Track analytics for all FAB actions
    this.analytics.trackFabAction(action, isImplemented);
    
    // Here we would implement the actual functionality
    switch(action) {
      case 'photo':
        console.log('Opening camera...');
        // Track unimplemented feature
        this.analytics.trackUnimplementedFeature('fab_action', 'photo', 'chat_page');
        // Show toast for unimplemented feature
        this.toastService.showToast({
          message: 'Photo capture not implemented yet. Check back soon!',
          duration: 3000,
          color: 'medium'
        });
        break;
      case 'barcode':
        console.log('Opening barcode scanner...');
        // Track unimplemented feature
        this.analytics.trackUnimplementedFeature('fab_action', 'barcode', 'chat_page');
        // Show toast for unimplemented feature
        this.toastService.showToast({
          message: 'Barcode scanner not implemented yet. Check back soon!',
          duration: 3000,
          color: 'medium'
        });
        break;
      case 'edit':
        console.log('Opening manual entry...');
        // This is implemented, so track as a successful action
        this.analytics.trackActionClick('manual_entry_open', 'fab_menu', { source: 'chat_page' });
        break;
    }
    
    // Close the FAB after action is clicked
    setTimeout(() => {
      this.isOpen = false;
      // Track FAB close after action
      this.analytics.trackFabToggle(false);
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

  // Check if the response contains pending food selection messages
  private containsPendingFoodSelection(messages: ChatMessage[] | undefined): boolean {
    if (!messages || messages.length === 0) {
      return false;
    }
    
    return messages.some(msg => 
      msg.role === MessageRoleTypes.PendingFoodSelection || 
      msg.role === MessageRoleTypes.PendingEditFoodSelection
    );
  }

  private async showErrorToast(message: string) {
    await this.toastService.showToast({ message, color: 'medium' });
  }

  // Process new messages from API responses and add them to the chat
  private processAndAddNewMessages(newMessages: ChatMessage[]): void {
    console.log('[DEBUG] Processing', newMessages.length, 'new messages:', newMessages);
    
    // Filter to only show allowed roles and convert to display messages
    const allowedRoles = [
      MessageRoleTypes.User,
      MessageRoleTypes.Assistant,
      MessageRoleTypes.PendingFoodSelection,
      MessageRoleTypes.CompletedFoodSelection,
      MessageRoleTypes.PendingEditFoodSelection,
      MessageRoleTypes.CompletedEditFoodSelection,
      MessageRoleTypes.ContextNote
    ];

    const newDisplayMessages: DisplayMessage[] = [];

    newMessages.forEach(msg => {
      if (allowedRoles.includes(msg.role!)) {
        // Skip cancelled messages
        if (msg.id && this.cancelledMessageIds.has(msg.id)) {
          console.log('[DEBUG] Skipping cancelled message:', msg.id);
          return;
        }
        
        // Check if message already exists (avoid duplicates)
        const existingMessageIndex = this.messages.findIndex(existing => existing.id === msg.id);
        
        let displayMessage: DisplayMessage;
        
        if (msg.role === MessageRoleTypes.ContextNote) {
          // Handle context notes separately
          displayMessage = {
            text: msg.content || '',
            isUser: false,
            isContextNote: true,
            timestamp: msg.createdDateUtc || new Date()
          };
        } else {
          // Handle regular messages
          displayMessage = {
            id: msg.id,
            text: msg.content || '',
            isUser: msg.role === MessageRoleTypes.User,
            timestamp: msg.createdDateUtc || new Date(),
            // foodOptions removed - use logMealToolResponse.foods instead
            mealName: msg.logMealToolResponse?.mealName || null,
            logMealToolResponse: msg.logMealToolResponse || null,
            role: msg.role
          };
        }

        if (existingMessageIndex !== -1) {
          // Update existing message (e.g., pending -> completed)
          console.log('[DEBUG] Updating existing message:', msg.id);
          this.messages[existingMessageIndex] = displayMessage;
        } else {
          // Add new message
          console.log('[DEBUG] Adding new message:', msg.id);
          newDisplayMessages.push(displayMessage);
        }
      }
    });

    // Add all new messages and create a new array reference to trigger change detection
    if (newDisplayMessages.length > 0) {
      console.log('[DEBUG] Adding', newDisplayMessages.length, 'new messages to chat');
      this.messages = [...this.messages, ...newDisplayMessages];
    } else {
      console.log('[DEBUG] No new messages to add, but creating new array reference for updates');
      // If we only updated existing messages, create new array reference
      this.messages = [...this.messages];
    }

    // Sort messages by timestamp to ensure correct order
    this.messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    console.log('[DEBUG] Total messages after processing:', this.messages.length);
    console.log('[DEBUG] Messages array after update:', this.messages);
    
    // Force change detection to ensure UI updates
    this.cdr.detectChanges();
    
    // Scroll to show new messages
    this.scrollToBottom();
  }

  // Handle food selection confirmation for standalone food selection components
  onFoodSelectionConfirmed(request: SubmitServingSelectionRequest): void {
    console.log('Food selections confirmed:', request);

    this.foodSelectionService.submitServingSelection(request).subscribe({
      next: (response: ChatMessagesResponse) => {
        if (!response.isSuccess) {
          console.warn('Selection submission failed:', response.errors);
          this.showErrorToast('Failed to log food selection.');
          return;
        }

        // Firebase Analytics: Track successful food entry creation
        if (response.messages && response.messages.length > 0) {
          // Look for a completed food selection message with food entry details
          const completedMessage = response.messages.find(msg => 
            msg.role === MessageRoleTypes.CompletedFoodSelection && 
            msg.logMealToolResponse?.foodEntryId
          );
          
          if (completedMessage?.logMealToolResponse) {
            const entryId = completedMessage.logMealToolResponse.foodEntryId || 'unknown';
            const mealName = completedMessage.logMealToolResponse.mealName || 'unknown';
            this.analytics.trackFoodEntryAdded(entryId, mealName);
          }
        }

        // Process the returned messages and add them to the chat
        if (response.messages && response.messages.length > 0) {
          this.processAndAddNewMessages(response.messages);
        }

        // Clear cancelled message IDs after successful food logging
        this.cancelledMessageIds.clear();

        // Notify other views (e.g., summary) that nutrients changed
        this.chatService.mealLogged$.next?.();
      },
      error: (error) => {
        console.error('Error submitting food selections:', error);
        this.showErrorToast('Failed to log food selection.');
      }
    });
  }

  // Handle edit food selection confirmation for standalone food selection components
// Child now emits a fully-formed SubmitEditServingSelectionRequest
onEditFoodSelectionConfirmed(evt: SubmitEditServingSelectionRequest): void {
  if (!evt.pendingMessageId || !evt.foodEntryId) {
    this.showErrorToast('Missing edit context. Please start editing again.');
    return;
  }

  // Ensure localDateKey is set (child may or may not provide it)
  evt.localDateKey = evt.localDateKey ?? this.dateService.getSelectedDate();

  // Submit and update the chat timeline
  this.foodSelectionService.submitEditServingSelection(evt).subscribe({
    next: (response) => {
      if (!response.isSuccess) {
        this.showErrorToast(response.errors?.[0]?.errorMessage ?? 'Failed to update food selection.');
        return;
      }

      // Process the returned messages and add them to the chat
      if (response.messages && response.messages.length > 0) {
        this.processAndAddNewMessages(response.messages);
      }

      // Clear cancelled message IDs after successful edit completion
      this.cancelledMessageIds.clear();

      // Notify other views (e.g., summary) that nutrients changed
      this.chatService.mealLogged$.next?.();
    },
    error: (err) => {
      console.error('Error submitting edit food selections:', err);
      this.showErrorToast('Failed to update food selection.');
    }
  });
}

  
  


  // Handle updated message from phrase editing
  onFoodPhraseUpdated(updatedMessage: DisplayMessage): void {
    console.log('Received updated message from phrase editing:', updatedMessage);
    
    // Find the original message in the array and replace it
    const messageIndex = this.messages.findIndex(m => m.id === updatedMessage.id);
    if (messageIndex !== -1) {
      // Replace the entire message
      this.messages[messageIndex] = updatedMessage;
      console.log('Replaced message at index:', messageIndex);
      
      // Trigger change detection
      this.cdr.detectChanges();
      
      // Scroll to bottom to show the updated content
      setTimeout(() => {
        this.scrollToBottom();
      }, 100);
    } else {
      console.warn('Could not find original message to replace');
    }
  }

  // Handle phrase edit request from food-selection component
  async onPhraseEditRequested(event: {originalPhrase: string, newPhrase: string, messageId: string, componentId?: string}): Promise<void> {
    console.log('Phrase edit/add requested:', event);
    
    // Find the message 
    const messageIndex = this.messages.findIndex(m => m.id === event.messageId);
    if (messageIndex === -1) {
      console.warn('Could not find message to edit');
      return;
    }
    
    const originalMessage = this.messages[messageIndex];
    const isAddingNew = !event.originalPhrase; // Empty originalPhrase means adding new food
    
    // Create a loading message - note that the backend will handle the actual loading state
    // through logMealToolResponse.foods structure
    const loadingMessage: DisplayMessage = {
      ...originalMessage,
      // Keep the existing structure for now, but add a loading indicator
      // The actual response will come back with the new foods structure
    };
    
    // Replace with loading message
    this.messages[messageIndex] = loadingMessage;
    this.cdr.detectChanges();
    
    try {
      // Call the appropriate API method based on whether we're adding or updating
      const request = new SearchFoodPhraseRequest({
        searchPhrase: event.newPhrase,
        originalPhrase: event.originalPhrase,
        messageId: event.messageId,
        componentId: event.componentId, // Include componentId in the request
        localDateKey: this.dateService.getSelectedDate()
      });
      
      let response;
      if (isAddingNew) {
        response = await this.foodSelectionService.searchFoodPhrase(request).toPromise();
      } else {
        response = await this.foodSelectionService.updateFoodPhrase(request).toPromise();
      }
      
      if (response?.isSuccess && response.updatedMessage) {
        console.log('SUCCESS: Received updated message');
        // Convert ChatMessage to DisplayMessage and replace
        const updatedDisplayMessage = this.convertChatMessageToDisplayMessage(response.updatedMessage);
        this.messages[messageIndex] = updatedDisplayMessage;
        this.cdr.detectChanges();
        
        setTimeout(() => {
          this.scrollToBottom();
        }, 100);
      } else {
        console.error('FAILED: API call unsuccessful', response?.errors);
        // Restore original message
        this.messages[messageIndex] = originalMessage;
        this.cdr.detectChanges();
        this.showErrorToast('Failed to search for food. Please try again.');
      }
    } catch (error) {
      console.error('ERROR: Exception during API call', error);
      // Restore original message
      this.messages[messageIndex] = originalMessage;
      this.cdr.detectChanges();
      this.showErrorToast('Failed to search for food. Please try again.');
    }
  }



  // Convert ChatMessage to DisplayMessage
  convertChatMessageToDisplayMessage(chatMessage: ChatMessage): DisplayMessage {
    return {
      id: chatMessage.id,
      text: chatMessage.content || '',
      isUser: chatMessage.role === MessageRoleTypes.User,
      timestamp: chatMessage.createdDateUtc || new Date(),
      // foodOptions removed - use logMealToolResponse.foods instead
      mealName: chatMessage.logMealToolResponse?.mealName || null,
      logMealToolResponse: chatMessage.logMealToolResponse || null,
      role: chatMessage.role
    };
  }

  // Create temporary loading message for phrase editing
  createPhraseEditingMessage(originalMessage: DisplayMessage, originalPhrase: string, newPhrase: string): DisplayMessage {
    return {
      ...originalMessage,
      isEditingPhrase: true,
      editingPhrase: originalPhrase,
      newPhrase: newPhrase
    };
  }

  // Handle food selection cancellation
  onCancelFoodSelection(message: DisplayMessage): void {
    if (!message.id) {
      console.warn('Cannot cancel food selection: message has no ID');
      return;
    }

    console.log('Canceling food selection for message:', message.id, 'Role:', message.role);

    // Remove the pending food selection message from UI
    const messageIndex = this.messages.findIndex(m => m.id === message.id);
    console.log('Found message at index:', messageIndex, 'Total messages before:', this.messages.length);
    
    if (messageIndex !== -1) {
      this.messages.splice(messageIndex, 1);
      console.log('Removed message, total messages after:', this.messages.length);
      
      // Track this message as cancelled to prevent re-adding
      this.cancelledMessageIds.add(message.id);
      console.log('Added message to cancelled list:', message.id);
      
      // Show thinking dots while waiting for assistant response
      this.isLoading = true;
      
      // Force change detection to ensure UI updates immediately
      this.cdr.detectChanges();
      
      // Additional debugging - log the messages array
      console.log('Messages array after removal:', this.messages.map(m => ({ id: m.id, role: m.role, text: m.text?.substring(0, 50) })));
    } else {
      console.warn('Message not found in array for removal');
    }

    // Use the appropriate API based on the message type
    if (message.role === MessageRoleTypes.PendingEditFoodSelection) {
      // Handle edit cancellation
      const request = new CancelEditSelectionRequest({
        pendingMessageId: message.id,
        localDateKey: this.dateService.getSelectedDate()
      });
      
      this.foodSelectionService.cancelEditSelection(request).subscribe({
        next: (response) => {
          this.handleCancelResponse(response, message, messageIndex);
        },
        error: (error) => {
          this.handleCancelError(error, message, messageIndex);
        }
      });
    } else {
      // Handle regular selection cancellation
      const request = new CancelServingSelectionRequest({
        pendingMessageId: message.id,
        localDateKey: this.dateService.getSelectedDate()
      });
      
      this.foodSelectionService.cancelFoodLogging(request).subscribe({
        next: (response) => {
          this.handleCancelResponse(response, message, messageIndex);
        },
        error: (error) => {
          this.handleCancelError(error, message, messageIndex);
        }
      });
    }
  }

  private handleCancelResponse(response: ChatMessagesResponse, message: DisplayMessage, messageIndex: number): void {
    console.log('Cancel response received:', response.isSuccess, 'Messages:', response.messages?.length);
    
    if (!response.isSuccess) {
      console.warn('Cancel food logging failed:', response.errors);
      this.showErrorToast('Failed to cancel food selection.');
      
      // Restore the pending food selection message if cancellation failed
      if (messageIndex !== -1) {
        console.log('Restoring message at index:', messageIndex);
        this.messages.splice(messageIndex, 0, message);
        console.log('Message restored, total messages:', this.messages.length);
        this.cdr.detectChanges();
      }
      // Turn off loading indicator
      this.isLoading = false;
      return;
    }

    // Set context note after successful cancellation
    this.chatService.setContextNote('Canceled food logging');

    // Process the returned messages and add them to the chat
    if (response.messages && response.messages.length > 0) {
      console.log('Processing new messages from cancel response');
      this.processAndAddNewMessages(response.messages);
    } else {
      console.log('No new messages in cancel response');
    }
    
    // Turn off loading indicator
    this.isLoading = false;
    
    // Focus the input after response is posted
    this.focusInput();
  }

  private handleCancelError(error: any, message: DisplayMessage, messageIndex: number): void {
    console.error('Error canceling food selection:', error);
    this.showErrorToast('Failed to cancel food selection.');
    
    // Restore the pending food selection message if cancellation failed
    if (messageIndex !== -1) {
      console.log('Restoring message due to error at index:', messageIndex);
      this.messages.splice(messageIndex, 0, message);
      console.log('Message restored due to error, total messages:', this.messages.length);
      this.cdr.detectChanges();
    }
    
    // Turn off loading indicator
    this.isLoading = false;
  }

  
} 
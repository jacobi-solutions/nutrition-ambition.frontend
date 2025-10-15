import { Component, OnInit, ViewChild, ElementRef, AfterViewInit, OnDestroy, inject, ChangeDetectorRef, NgZone } from '@angular/core';
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
import { ComponentDisplay, FoodDisplay, ComponentMatchDisplay } from '../../models/food-selection-display';
import {
  ChatMessagesResponse,
  ChatMessage,
  MessageRoleTypes,
    SubmitServingSelectionRequest,
    CancelServingSelectionRequest,
    CancelEditSelectionRequest,
    SubmitEditServingSelectionRequest,
    MealSelection,
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

// Type for handling both camelCase and PascalCase responses from backend
type ChatMessagesResponseVariant = ChatMessagesResponse | {
  Messages: Array<{ Content: string; content?: string }>;
  messages?: Array<{ Content: string; content?: string }>;
};



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

  // Streaming optimization
  private streamUpdateTimeout: any;
  private isUserScrolledUp = false;
  private lastScrollTime = 0;
  private scrollDebounceMs = 1000; // Only autoscroll once per second
  isStreamingActive = false; // Prevent multiple concurrent messages (public for template)
  private activeStream: any = null; // Store active stream for cancellation

  // Streaming configuration constants
  private readonly STREAM_THROTTLE_MS = 50;
  private readonly FOCUS_INPUT_DELAY_MS = 300;

  // Track messages by ID to preserve component instances during updates
  trackMessage(index: number, message: DisplayMessage): string {
    return message.id || `${index}`;
  }
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
    private analytics: AnalyticsService, // Firebase Analytics tracking
    private ngZone: NgZone
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

    // Clean up streaming timeout
    if (this.streamUpdateTimeout) {
      clearTimeout(this.streamUpdateTimeout);
    }
  }

  ngAfterViewInit() {
    
    // Check if content is available
    if (!this.content) {
      // IonContent reference is not available in ngAfterViewInit
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
      
      // Filter out pending edit messages - only process completed edit messages
      const completedMessages = pendingMessages.filter(msg => 
        msg.role !== MessageRoleTypes.PendingEditFoodSelection
      );
      
      if (completedMessages.length > 0) {
        // Only process if we're currently viewing today's date (edit operations always happen on today)
        const today = format(new Date(), 'yyyy-MM-dd');
        if (this.selectedDate === today) {
          this.processAndAddNewMessages(completedMessages);
        }
      } else {
      }
      this.isLoading = false;
    }
  }

  // This will be called when the component has been fully activated
  ionViewDidEnter() {
    // Ensure we scroll to bottom when the view is fully active
    this.scrollToBottom();

    // Adjust textarea height if there is a restored draft
    if (this.messageInput?.nativeElement && this.userMessage) {
      this.adjustTextareaHeight(this.messageInput.nativeElement);
    }
  }

  // Handle date changes from the header
  onDateChanged(newDate: string) {
    
    // Update local value first
    this.selectedDate = newDate;
    
    // Then update the service
    this.dateService.setSelectedDate(newDate);
  }
  
  // Handle navigation to previous day
  onPreviousDay() {
    this.dateService.goToPreviousDay();
  }
  
  // Handle navigation to next day
  onNextDay() {
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
    
    
    // Check if user is authenticated via Firebase Auth
    const isAuthenticated = await this.authService.isAuthenticated();
    
    // For users who aren't authenticated yet, just show the static welcome message
    // Don't make any backend calls until they're authenticated
    if (!isAuthenticated) {
      this.isLoadingHistory = false;
      
      
      
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
    
    // Get message history for the selected date - auth token is added by AuthInterceptor
    this.chatService.getMessageHistoryByDate(localDateKey)
      .pipe(
        catchError(error => {
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
          this.scrollToBottom();
        })
      )
      .subscribe({
        next: (response: ChatMessagesResponse | null) => {
          if (response && response.isSuccess && response.messages && response.messages.length > 0) {
            // Convert API messages to display messages
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
              mealName: msg.mealSelections?.[0]?.mealName || null,
              mealSelection: msg.mealSelections?.[0] || null,
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

    // Add user message to UI
    this.messages.push({
      text: sentMessage,
      isUser: true,
      timestamp: messageDate
    });

    // Remove any persisted draft and clear input. Then show loading
    localStorage.removeItem(this.draftStorageKey);
    this.userMessage = '';
    this.isLoading = true;
    this.isStreamingActive = true; // Disable sending while streaming

    // Reset textarea height
    if (this.messageInput && this.messageInput.nativeElement) {
      this.messageInput.nativeElement.style.height = 'auto';
    }

    // Scroll for user's message
    this.scrollToBottom();

    // Track if we've added the assistant message yet
    let streamingMessageIndex = -1;
    let pendingContent = '';

    // Send the message with streaming
    this.activeStream = await this.chatService.sendMessageStream(
      sentMessage,
      (chunk: ChatMessagesResponse) => {

        // Check for error response and bail out early
        if (!chunk.isSuccess && chunk.errors && chunk.errors.length > 0) {
          console.error('Received error chunk from backend:', chunk.errors);
          return; // Let the error be handled by stream completion or dedicated error handler
        }

        // Handle both camelCase and PascalCase (backend sends PascalCase)
        const chunkVariant = chunk as ChatMessagesResponseVariant;
        const messages = 'messages' in chunkVariant
          ? chunkVariant.messages
          : (chunkVariant as any).Messages;

        if (messages && messages.length > 0) {
          const assistantMessage = messages[0];
          const content = 'content' in assistantMessage
            ? assistantMessage.content
            : (assistantMessage as any).Content;
          // Backend sends Role (capital R), check both cases
          const role = (assistantMessage as any).Role || (assistantMessage as any).role || MessageRoleTypes.Assistant;
          const mealSelections = (assistantMessage as any).MealSelections || (assistantMessage as any).mealSelections;

          // Check if this is a streaming meal selection
          const isPartial = chunk.isPartial || false;
          const processingStage = chunk.processingStage;

          // Handle streaming meal selection differently
          // Check both string and numeric enum values
          const isPendingFood = role === MessageRoleTypes.PendingFoodSelection || role === 'PendingFoodSelection' || role === 5;
          // Always show meal selection card when role is PendingFoodSelection, even if empty (for progressive loading)
          if (isPendingFood && mealSelections) {
            const mealSelection = mealSelections[0];

            // Clear existing timeout
            if (this.streamUpdateTimeout) {
              clearTimeout(this.streamUpdateTimeout);
            }

            // Create or update the meal selection message immediately (no throttle for meal selection)
            this.ngZone.run(() => {
              // Hide loading dots when first content arrives
              this.isLoading = false;

              // Extract stable message ID from backend (generated at start of streaming)
              const messageId = (assistantMessage as any).Id || (assistantMessage as any).id;

              // Create or update the meal selection message
              if (streamingMessageIndex === -1) {
                streamingMessageIndex = this.messages.length;
                this.messages = [...this.messages, {
                  id: messageId, // Use backend's stable MongoDB ID from the first chunk
                  text: content || '',
                  isUser: false,
                  timestamp: new Date(),
                  role: MessageRoleTypes.PendingFoodSelection,
                  mealSelection: mealSelection,
                  mealName: mealSelection?.mealName,
                  isStreaming: true,
                  isPartial: isPartial,
                  processingStage: processingStage,
                  mealSelectionIsPending: mealSelection?.isPending || false
                }];
                this.scrollToBottom();
              } else {
                // Update existing message
                const updatedMessages = [...this.messages];
                const existingMessage = updatedMessages[streamingMessageIndex];

                updatedMessages[streamingMessageIndex] = {
                  ...existingMessage,
                  // Use the stable message ID from backend (already extracted above)
                  id: messageId || existingMessage.id,
                  text: content || '',
                  mealSelection: mealSelection,
                  mealName: mealSelection?.mealName,
                  mealSelectionIsPending: mealSelection?.isPending || false,
                  isStreaming: isPartial,
                  isPartial: isPartial,
                  processingStage: processingStage
                };
                this.messages = updatedMessages;

                if (!this.isUserScrolledUp) {
                  this.scrollToBottom();
                }
              }

              this.cdr.detectChanges();
            });
          } else {
            // Regular text streaming (existing logic)
            pendingContent = content;

            // Clear existing timeout
            if (this.streamUpdateTimeout) {
              clearTimeout(this.streamUpdateTimeout);
            }

            // Throttle UI updates to every 50ms for smoother rendering
            this.streamUpdateTimeout = setTimeout(() => {
              this.ngZone.run(() => {
                // Hide loading dots when first content arrives
                this.isLoading = false;

                // Skip if content is empty or whitespace
                if (!pendingContent || pendingContent.trim().length === 0) {
                  return;
                }

                // Create the assistant message bubble on first chunk
                if (streamingMessageIndex === -1) {
                  streamingMessageIndex = this.messages.length;
                  const streamingMessageId = `streaming-${Date.now()}`;
                  this.messages = [...this.messages, {
                    id: streamingMessageId,
                    text: pendingContent || '',
                    isUser: false,
                    timestamp: new Date(),
                    role: MessageRoleTypes.Assistant,
                    isStreaming: true
                  }];
                  // Always scroll on first chunk
                  this.scrollToBottom();
                } else {
                  // Update existing message by replacing the array
                  const updatedMessages = [...this.messages];
                  const existingMessage = updatedMessages[streamingMessageIndex];
                  updatedMessages[streamingMessageIndex] = {
                    ...existingMessage,
                    text: pendingContent || '',
                    isStreaming: true
                  };
                  this.messages = updatedMessages;

                  // Only auto-scroll if user hasn't scrolled up
                  if (!this.isUserScrolledUp) {
                    this.scrollToBottom();
                  }
                }

                this.cdr.detectChanges();
              });
            }, this.STREAM_THROTTLE_MS);
          }
        }
      },
      () => {
        // Stream complete - ensure final update is rendered
        if (this.streamUpdateTimeout) {
          clearTimeout(this.streamUpdateTimeout);
        }

        // Force final update immediately
        this.ngZone.run(() => {
          if (streamingMessageIndex !== -1) {
            const updatedMessages = [...this.messages];
            const existingMessage = updatedMessages[streamingMessageIndex];
            updatedMessages[streamingMessageIndex] = {
              ...existingMessage,
              text: existingMessage.text || pendingContent,
              isStreaming: false, // Remove streaming indicator
              isPartial: false // Mark as complete
            };
            this.messages = updatedMessages;
            this.cdr.detectChanges();

            // Scroll to bottom on completion if not scrolled up
            if (!this.isUserScrolledUp) {
              this.scrollToBottom();
            }
          }

          this.isStreamingActive = false; // Re-enable sending
          this.activeStream = null; // Clear stream reference

          // Firebase Analytics: Track successful message sent
          this.analytics.trackChatMessageSent(sentMessage.length);
          this.analytics.trackPageView('Chat');

          // Focus the input after completion
          setTimeout(() => this.focusInput(), this.FOCUS_INPUT_DELAY_MS);
        });
      },
      (error: any) => {
        // Stream error - clean up timeout and streaming state
        if (this.streamUpdateTimeout) {
          clearTimeout(this.streamUpdateTimeout);
          this.streamUpdateTimeout = null;
        }

        this.isLoading = false;
        this.isStreamingActive = false; // Re-enable sending
        this.activeStream = null; // Clear stream reference

        // Check if message was removed by user cancellation
        // If the message is gone (streamingMessageIndex exists but message not in array), user cancelled intentionally
        const messageStillExists = streamingMessageIndex !== -1 &&
                                   this.messages[streamingMessageIndex] !== undefined;

        // Only show error if this wasn't a user-initiated cancellation
        if (messageStillExists) {
          this.messages[streamingMessageIndex] = {
            text: "Sorry, I'm having trouble right now. Please try again.",
            isUser: false,
            timestamp: new Date()
          };
        } else if (streamingMessageIndex === -1) {
          // No streaming message created yet, add error as new message
          this.messages = [...this.messages, {
            text: "Sorry, I'm having trouble right now. Please try again.",
            isUser: false,
            timestamp: new Date()
          }];
        }
        // else: message was removed (user cancelled) - don't show error

        this.cdr.detectChanges();
        this.scrollToBottom();
        this.focusInput();
      }
    );
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
  async onScroll(event: any) {
    // Check if user has scrolled up from the bottom
    if (this.content) {
      const scrollElement = await this.content.getScrollElement();
      const scrollTop = scrollElement.scrollTop;
      const scrollHeight = scrollElement.scrollHeight;
      const clientHeight = scrollElement.clientHeight;

      // Consider user at bottom if within 100px of bottom
      const threshold = 100;
      this.isUserScrolledUp = (scrollTop + clientHeight + threshold) < scrollHeight;
    }
  }

  private async scrollToBottom() {
    // Note: Caller is responsible for checking isUserScrolledUp before calling this
    // Update last scroll time
    this.lastScrollTime = Date.now();

    // Single timeout to allow DOM rendering, then handle scrolling
    setTimeout(async () => {
      if (!this.content) {
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
        
        // If message is taller than 40% of viewport, position it near the top
        if (messageHeight > viewportHeight * 0.4) {
          const marginFromTop = viewportHeight * 0.05; // 5% margin from top
          const messageOffsetTop = lastMessageElement.offsetTop;
          const scrollPosition = Math.max(0, messageOffsetTop - marginFromTop);
          
          await this.content.scrollToPoint(0, scrollPosition, 300);
        } else {
          this.content.scrollToBottom(300);
        }
        
      } catch (error) {
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
    // Determine if the action is implemented
    const implementedActions = ['edit']; // Only manual entry is currently working
    const isImplemented = implementedActions.includes(action);
    
    // Track analytics for all FAB actions
    this.analytics.trackFabAction(action, isImplemented);
    
    // Here we would implement the actual functionality
    switch(action) {
      case 'photo':
        // Track unimplemented feature
        this.analytics.trackUnimplementedFeature('fab_action', 'photo', 'chat_page');
        // Show toast for unimplemented feature
        this.toastService.showToast({
          message: 'Photo capture not implemented yet. Check back soon!',
          duration: 1500,
          color: 'medium'
        });
        break;
      case 'barcode':
        // Track unimplemented feature
        this.analytics.trackUnimplementedFeature('fab_action', 'barcode', 'chat_page');
        // Show toast for unimplemented feature
        this.toastService.showToast({
          message: 'Barcode scanner not implemented yet. Check back soon!',
          duration: 1500,
          color: 'medium'
        });
        break;
      case 'edit':
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
            mealName: msg.mealSelections?.[0]?.mealName || null,
            mealSelection: msg.mealSelections?.[0] || null,
            role: msg.role
          };
        }

        if (existingMessageIndex !== -1) {
          // Update existing message (e.g., pending -> completed)
          this.messages[existingMessageIndex] = displayMessage;
        } else {
          // Add new message
          newDisplayMessages.push(displayMessage);
        }
      }
    });

    // Add all new messages and create a new array reference to trigger change detection
    if (newDisplayMessages.length > 0) {
      this.messages = [...this.messages, ...newDisplayMessages];
    } else {
      // If we only updated existing messages, create new array reference
      this.messages = [...this.messages];
    }

    // Sort messages by timestamp to ensure correct order
    this.messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    // Force change detection to ensure UI updates
    this.cdr.detectChanges();
    
    // Scroll to show new messages
    this.scrollToBottom();
  }

  // Handle food selection confirmation for standalone food selection components
  onFoodSelectionConfirmed(request: SubmitServingSelectionRequest): void {
    this.foodSelectionService.submitServingSelection(request).subscribe({
      next: (response: ChatMessagesResponse) => {
        if (!response.isSuccess) {
          this.showErrorToast('Failed to log food selection.');
          return;
        }

        // Firebase Analytics: Track successful food entry creation
        if (response.messages && response.messages.length > 0) {
          // Look for a completed food selection message with food entry details
          const completedMessage = response.messages.find(msg =>
            msg.role === MessageRoleTypes.CompletedFoodSelection &&
            msg.mealSelections?.[0]?.foodEntryId
          );

          if (completedMessage?.mealSelections?.[0]) {
            const entryId = completedMessage.mealSelections[0].foodEntryId || 'unknown';
            const mealName = completedMessage.mealSelections[0].mealName || 'unknown';
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
      this.showErrorToast('Failed to update food selection.');
    }
  });
}

  
  


  // Handle updated message from phrase editing
  onFoodPhraseUpdated(updatedMessage: DisplayMessage): void {
    
    // Find the original message in the array and replace it
    const messageIndex = this.messages.findIndex(m => m.id === updatedMessage.id);
    if (messageIndex !== -1) {
      // Replace the entire message
      this.messages[messageIndex] = updatedMessage;
      
      // Trigger change detection
      this.cdr.detectChanges();
      
      // Scroll to bottom to show the updated content
      setTimeout(() => {
        this.scrollToBottom();
      }, 100);
    }
  }


  // Convert ChatMessage to DisplayMessage
  convertChatMessageToDisplayMessage(chatMessage: ChatMessage): DisplayMessage {
    return {
      id: chatMessage.id,
      text: chatMessage.content || '',
      isUser: chatMessage.role === MessageRoleTypes.User,
      timestamp: chatMessage.createdDateUtc || new Date(),
      mealName: chatMessage.mealSelections?.[0]?.mealName || null,
      mealSelection: chatMessage.mealSelections?.[0] || null,
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

  // Create a loading message by replacing the target component with a loading placeholder
  createLoadingMessageForComponent(originalMessage: DisplayMessage, componentId?: string, isAddingNew: boolean = false): DisplayMessage {
    if (!originalMessage.mealSelection?.foods) {
      return originalMessage;
    }

    // Deep clone the message structure
    const clonedResponse = JSON.parse(JSON.stringify(originalMessage.mealSelection));
    
    if (isAddingNew) {
      // For adding new foods, add a new loading component to the foods array
      const loadingFood: FoodDisplay = new FoodDisplay({
        id: 'loading-' + Date.now(),
        name: '',
        components: [new ComponentDisplay({
          id: 'loading-component',
          isSearching: true,  // Direct flag instead of complex detection
          matches: [new ComponentMatchDisplay({
            providerFoodId: 'loading',
            displayName: '',
            isNewAddition: true,
            servings: [],
            rank: 0
          })]
        })]
      });
      clonedResponse.foods.push(loadingFood);
    } else if (componentId) {
      // For component edits, find and replace the specific component
      if (clonedResponse.foods) {
        for (const food of clonedResponse.foods) {
          if (food.components) {
            for (const component of food.components) {
              if (component.id === componentId) {
                // Set searching flag and replace matches with loading placeholder
                (component as ComponentDisplay).isSearching = true;
                component.matches = [{
                  providerFoodId: 'loading',
                  displayName: '',
                  isEditingPhrase: true,  // Keep this for backward compatibility
                  servings: [],
                  rank: 0
                }];
                break;
              }
            }
          }
        }
      }
    }

    const loadingMessage: DisplayMessage = {
      ...originalMessage,
      mealSelection: clonedResponse
    };

    return loadingMessage;
  }

  // Handle food selection cancellation
  onCancelFoodSelection(message: DisplayMessage): void {
    if (!message.id) {
      return;
    }

    // Cancel active stream if one is running
    if (this.activeStream) {
      this.activeStream.close();
      this.activeStream = null;
      this.isStreamingActive = false;
    }

    // Remove the pending food selection message from UI
    const messageIndex = this.messages.findIndex(m => m.id === message.id);

    if (messageIndex !== -1) {
      this.messages.splice(messageIndex, 1);

      // Track this message as cancelled to prevent re-adding
      this.cancelledMessageIds.add(message.id);

      // Force change detection to ensure UI updates immediately
      this.cdr.detectChanges();
    }

    // IMPORTANT: Only call backend API if message was persisted (streaming completed)
    // During streaming, message hasn't been saved to DB yet - closing the connection is sufficient
    if (message.isStreaming || message.isPartial) {
      return;
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

    if (!response.isSuccess) {
      this.showErrorToast('Failed to cancel food selection.');

      // Restore the pending food selection message if cancellation failed
      if (messageIndex !== -1) {
        this.messages.splice(messageIndex, 0, message);
        this.cdr.detectChanges();
      }
      this.isLoading = false;
      return;
    }

    // Set context note after successful cancellation
    this.chatService.setContextNote('Canceled food logging');

    // Don't show the AI's acknowledgment message - just remove the card and be done
    // The backend still sends a tool response to satisfy OpenAI requirements,
    // but we don't display it to the user

    // Turn off loading indicator
    this.isLoading = false;

    // Focus the input after cancellation
    this.focusInput();
  }

  private handleCancelError(error: any, message: DisplayMessage, messageIndex: number): void {
    this.showErrorToast('Failed to cancel food selection.');

    // Restore the pending food selection message if cancellation failed
    if (messageIndex !== -1) {
      this.messages.splice(messageIndex, 0, message);
      this.cdr.detectChanges();
    }
    this.isLoading = false;
  }

  
} 
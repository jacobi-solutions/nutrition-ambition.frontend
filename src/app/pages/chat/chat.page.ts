import { Component, OnInit, ViewChild, ElementRef, AfterViewInit, OnDestroy, inject, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonFab, IonFabButton, IonFabList, IonContent, IonFooter, IonIcon, IonSpinner, IonText, IonRefresher, IonRefresherContent, AnimationController, ModalController, Platform } from '@ionic/angular/standalone';
import { ViewWillEnter } from '@ionic/angular';
import { AppHeaderComponent } from '../../components/header/header.component';
import { addIcons } from 'ionicons';
import { addOutline, barcodeSharp, camera, closeCircleOutline, create, paperPlaneSharp, search } from 'ionicons/icons';
import { AuthService } from '../../services/auth.service';
import { ChatService } from '../../services/chat.service';
import { ChatStreamService } from '../../services/chat-stream.service';
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
    SearchFoodPhraseRequest,
    NutritionAmbitionApiService,
    GetSharedMealRequest,
    UpdateMealSelectionRequest,
    CreateSharedMealRequest,
    CreateSharedMealResponse,
    SetupGoalsRequest,
    LearnMoreAboutRequest
} from '../../services/nutrition-ambition-api.service';
import { catchError, finalize, of, Subscription } from 'rxjs';
import { Router, ActivatedRoute } from '@angular/router';
import { ChatMessageComponent } from 'src/app/components/chat-message/chat-message.component';
import { FoodSelectionComponent } from 'src/app/components/food-selection/food-selection.component';
import { format } from 'date-fns';
import { ToastService } from '../../services/toast.service';
import { FoodSelectionService } from 'src/app/services/food-selection.service';
import { AnalyticsService } from '../../services/analytics.service';
import { ShareMealModalComponent } from '../../components/share-meal-modal/share-meal-modal.component';

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
  private lastScrollTime = 0;
  private scrollDebounceMs = 1000; // Only autoscroll once per second
  isStreamingActive = false; // Prevent multiple concurrent messages (public for template)
  private activeStream: any = null; // Store active stream for cancellation
  private hasScrolledForCurrentStream = false; // Track if we've already scrolled for the current stream

  // Streaming configuration constants
  private readonly STREAM_THROTTLE_MS = 50;
  private readonly FOCUS_INPUT_DELAY_MS = 300;

  // Auto-retry flag to prevent multiple simultaneous retries
  private isRetrying = false;

  // Flag to skip auto-retry after loading a shared meal
  private skipNextAutoRetry = false;

  // Platform detection - only auto-focus on desktop, not mobile
  private isMobile = false;

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
    private chatStreamService: ChatStreamService,
    private foodSelectionService: FoodSelectionService,
    private authService: AuthService,
    private dateService: DateService,
    private router: Router,
    private route: ActivatedRoute,
    private toastService: ToastService,
    private cdr: ChangeDetectorRef,
    private analytics: AnalyticsService, // Firebase Analytics tracking
    private ngZone: NgZone,
    private apiService: NutritionAmbitionApiService,
    private modalController: ModalController,
    private platform: Platform
  ) {
    // Add the icons explicitly to the library
    addIcons({
      paperPlaneSharp,
      camera,
      create,
      barcodeSharp,
      addOutline,
      closeCircleOutline,
      search
    });

    // Detect if we're on a mobile platform (iOS or Android)
    // Auto-focus is annoying on mobile when keyboard pops up, but helpful on desktop
    this.isMobile = this.platform.is('ios') || this.platform.is('android');
  }

  async ngOnInit() {
    // Check for share token in route params FIRST - before any subscriptions
    const shareToken = this.route.snapshot.paramMap.get('token');
  

    if (shareToken) {
     
      await this.handleSharedMeal(shareToken);
      
      // Navigate to regular chat after handling share
      await this.router.navigate(['/app/chat'], { replaceUrl: true });
    }

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
    
    // Subscribe to setup goals trigger
    this.chatService.setupGoalsTrigger$.subscribe(async ({ localDateKey, isTweaking }) => {
      await this.startSetupGoalsStream(localDateKey, isTweaking);
    });

    // Subscribe to learn more about trigger
    this.chatService.learnMoreAboutTrigger$.subscribe(async ({ topic, localDateKey }) => {
      await this.startLearnMoreAboutStream(topic, localDateKey);
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

        // Focus the input after response is processed (desktop only)
        if (!this.isMobile) {
          setTimeout(() => this.focusInput(), 300);
        }
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
  async ionViewWillEnter() {
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

    // NOTE: Auto-retry check moved to checkForIncompleteMeals() which runs after loadChatHistory completes
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
              role: msg.role,
              retryCount: msg.retryCount,
              createdDateUtc: msg.createdDateUtc,
              lastUpdatedDateUtc: msg.lastUpdatedDateUtc
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

            // Check for incomplete meals after messages are loaded
            this.checkForIncompleteMeals();

            // Scroll at the end of the next event cycle
            this.scrollToBottom();
          }
          // Don't start a conversation automatically - we'll show static message instead
        }
      });
  }

  // Check for incomplete meals and trigger auto-retry if needed
  private checkForIncompleteMeals(): void {
    // Skip if we just loaded a shared meal (to prevent retrying old incomplete meals)
    if (this.skipNextAutoRetry) {
      this.skipNextAutoRetry = false;
      return;
    }

    // Prevent multiple simultaneous retries
    if (this.isRetrying) {
      return;
    }

    // Only check on today's date
    const today = format(new Date(), 'yyyy-MM-dd');
    if (this.selectedDate !== today) {
      return;
    }

    // Find incomplete meals
    const incompleteMealMessage = this.messages.find(msg =>
      this.hasIncompleteMeal(msg)
    );

    if (incompleteMealMessage) {
      // Backend handles all retry logic automatically
      this.handleIncompleteMeal(incompleteMealMessage);
    }
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
    this.hasScrolledForCurrentStream = false; // Reset scroll tracking for new stream

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

              // Check if message already exists by messageId (not by streamingMessageIndex)
              const existingMessageIndex = messageId
                ? this.messages.findIndex(m => m.id === messageId)
                : -1;

              // Create or update the meal selection message
              if (existingMessageIndex === -1) {
                // First chunk - create the message and scroll once
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

                // Scroll only once for the entire stream
                if (!this.hasScrolledForCurrentStream) {
                  this.scrollToBottom();
                  this.hasScrolledForCurrentStream = true;
                }
              } else {
                // Update streamingMessageIndex to the existing message
                streamingMessageIndex = existingMessageIndex;
                // Subsequent chunks - update existing message (no auto-scroll)
                const updatedMessages = [...this.messages];
                const existingMessage = updatedMessages[streamingMessageIndex];

                // Merge foods by food.id instead of replacing entire mealSelection
                // This preserves user-added foods (favorites, quick searches) during streaming
                let mergedMealSelection = mealSelection;
                if (existingMessage.mealSelection && mealSelection) {
                  const existingFoods = existingMessage.mealSelection.foods || [];
                  const streamingFoods = mealSelection.foods || [];

                  console.log('🔄 ===== FOOD MERGE START =====');
                  console.log(`📨 MessageId: ${messageId}`);
                  console.log(`📦 Existing foods (${existingFoods.length}):`, existingFoods.map((f: any) => ({ name: f.name, id: f.id })));
                  console.log(`📥 Streaming foods (${streamingFoods.length}):`, streamingFoods.map((f: any) => ({ name: f.name, id: f.id })));

                  // Start with all existing foods
                  const mergedFoods = [...existingFoods];

                  // For each streaming food, either update existing or append new
                  streamingFoods.forEach((streamingFood: any) => {
                    console.log(`\n🔍 Processing: "${streamingFood.name}" (id: ${streamingFood.id})`);
                    if (streamingFood.id) {
                      const existingIndex = mergedFoods.findIndex((f: any) => f.id === streamingFood.id);
                      console.log(`   Search result: ${existingIndex >= 0 ? `Found at index ${existingIndex}` : 'NOT FOUND'}`);
                      if (existingIndex >= 0) {
                        // Update existing food (streaming update)
                        console.log(`   ✅ UPDATING existing food at index ${existingIndex}`);
                        mergedFoods[existingIndex] = streamingFood;
                      } else {
                        // Append new food (user action during streaming)
                        console.log(`   ➕ APPENDING as new food (will create duplicate if same food)`);
                        mergedFoods.push(streamingFood);
                      }
                    } else {
                      console.log(`   ⚠️ WARNING: Food has NO ID - skipping merge`);
                    }
                  });

                  console.log(`\n📊 Final merged foods (${mergedFoods.length}):`, mergedFoods.map((f: any) => ({ name: f.name, id: f.id })));
                  console.log('🔄 ===== FOOD MERGE END =====\n');

                  // Preserve mealSelection.id for future multi-meal-selection support
                  mergedMealSelection = {
                    ...mealSelection,
                    id: existingMessage.mealSelection.id || mealSelection.id,
                    foods: mergedFoods
                  };
                }

                updatedMessages[streamingMessageIndex] = {
                  ...existingMessage,
                  // Use the stable message ID from backend (already extracted above)
                  id: messageId || existingMessage.id,
                  text: content || '',
                  mealSelection: mergedMealSelection,
                  mealName: mealSelection?.mealName,
                  mealSelectionIsPending: mealSelection?.isPending || false,
                  isStreaming: isPartial,
                  isPartial: isPartial,
                  processingStage: processingStage
                };
                this.messages = updatedMessages;
              }

              this.cdr.detectChanges();
            });
          } else {
            // Regular text streaming (existing logic)
            pendingContent = content;

            // Check if this is the first chunk and scroll immediately (outside throttle)
            if (streamingMessageIndex === -1 && !this.hasScrolledForCurrentStream) {
              this.scrollToBottom();
              this.hasScrolledForCurrentStream = true;
            }

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
                  // First chunk - create the message
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
                } else {
                  // Subsequent chunks - update existing message
                  const updatedMessages = [...this.messages];
                  const existingMessage = updatedMessages[streamingMessageIndex];
                  updatedMessages[streamingMessageIndex] = {
                    ...existingMessage,
                    text: pendingContent || '',
                    isStreaming: true
                  };
                  this.messages = updatedMessages;
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
            // Message was created during streaming - update it
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
          } else if (pendingContent && pendingContent.trim().length > 0) {
            // Message was never created during streaming (arrived too fast) - create it now
            this.isLoading = false;
            this.messages = [...this.messages, {
              id: `streaming-${Date.now()}`,
              text: pendingContent,
              isUser: false,
              timestamp: new Date(),
              role: MessageRoleTypes.Assistant,
              isStreaming: false
            }];
            this.cdr.detectChanges();
            this.scrollToBottom();
          }

          this.isStreamingActive = false; // Re-enable sending
          this.activeStream = null; // Clear stream reference

          // Firebase Analytics: Track successful message sent
          this.analytics.trackChatMessageSent(sentMessage.length);
          this.analytics.trackPageView('Chat');

          // Focus the input after completion (desktop only)
          if (!this.isMobile) {
            setTimeout(() => this.focusInput(), this.FOCUS_INPUT_DELAY_MS);
          }
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
        // Focus input on error (desktop only)
        if (!this.isMobile) {
          this.focusInput();
        }
      }
    );
  }

  // Start setup goals streaming
  async startSetupGoalsStream(localDateKey: string, isTweaking: boolean) {
    // Set loading state
    this.isLoading = true;
    this.isStreamingActive = true; // Disable sending while streaming
    this.hasScrolledForCurrentStream = false; // Reset scroll tracking for new stream

    // Track if we've added the assistant message yet
    let streamingMessageIndex = -1;
    let pendingContent = '';

    // Create request
    const request = new SetupGoalsRequest({
      localDateKey: localDateKey,
      isTweaking: isTweaking
    });

    // Start the stream
    this.activeStream = await this.chatStreamService.setupGoalsStream(
      request,
      (chunk: ChatMessagesResponse) => {
        // Check for error response and bail out early
        if (!chunk.isSuccess && chunk.errors && chunk.errors.length > 0) {
          console.error('Received error chunk from backend:', chunk.errors);
          return;
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
                // Scroll only once for the entire stream
                if (!this.hasScrolledForCurrentStream) {
                  this.scrollToBottom();
                  this.hasScrolledForCurrentStream = true;
                }
              } else {
                // Subsequent chunks - update existing message (no auto-scroll)
                const updatedMessages = [...this.messages];
                const existingMessage = updatedMessages[streamingMessageIndex];
                updatedMessages[streamingMessageIndex] = {
                  ...existingMessage,
                  text: pendingContent || '',
                  isStreaming: true
                };
                this.messages = updatedMessages;
              }

              this.cdr.detectChanges();
            });
          }, this.STREAM_THROTTLE_MS);
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
            // Message was created during streaming - update it
            const updatedMessages = [...this.messages];
            const existingMessage = updatedMessages[streamingMessageIndex];
            updatedMessages[streamingMessageIndex] = {
              ...existingMessage,
              text: existingMessage.text || pendingContent,
              isStreaming: false,
              isPartial: false
            };
            this.messages = updatedMessages;
            this.cdr.detectChanges();
          } else if (pendingContent && pendingContent.trim().length > 0) {
            // Message was never created during streaming - create it now
            this.isLoading = false;
            this.messages = [...this.messages, {
              id: `streaming-${Date.now()}`,
              text: pendingContent,
              isUser: false,
              timestamp: new Date(),
              role: MessageRoleTypes.Assistant,
              isStreaming: false
            }];
            this.cdr.detectChanges();
            this.scrollToBottom();
          }

          this.isStreamingActive = false;
          this.activeStream = null;

          // Focus the input after completion (desktop only)
          if (!this.isMobile) {
            setTimeout(() => this.focusInput(), this.FOCUS_INPUT_DELAY_MS);
          }
        });
      },
      (error: any) => {
        // Stream error - clean up timeout and streaming state
        if (this.streamUpdateTimeout) {
          clearTimeout(this.streamUpdateTimeout);
          this.streamUpdateTimeout = null;
        }

        this.isLoading = false;
        this.isStreamingActive = false;
        this.activeStream = null;

        // Check if message was removed by user cancellation
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

        this.cdr.detectChanges();
        // Focus input on error (desktop only)
        if (!this.isMobile) {
          this.focusInput();
        }
      }
    );
  }

  // Start learn more about streaming
  async startLearnMoreAboutStream(topic: string, localDateKey: string) {
    // Set loading state
    this.isLoading = true;
    this.isStreamingActive = true; // Disable sending while streaming
    this.hasScrolledForCurrentStream = false; // Reset scroll tracking for new stream

    // Track if we've added the assistant message yet
    let streamingMessageIndex = -1;
    let pendingContent = '';

    // Create request
    const request = new LearnMoreAboutRequest({
      topic: topic,
      localDateKey: localDateKey
    });

    // Start the stream
    this.activeStream = await this.chatStreamService.learnMoreAboutStream(
      request,
      (chunk: ChatMessagesResponse) => {
        // Check for error response and bail out early
        if (!chunk.isSuccess && chunk.errors && chunk.errors.length > 0) {
          console.error('Received error chunk from backend:', chunk.errors);
          return;
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
                // Scroll only once for the entire stream
                if (!this.hasScrolledForCurrentStream) {
                  this.scrollToBottom();
                  this.hasScrolledForCurrentStream = true;
                }
              } else {
                // Subsequent chunks - update existing message (no auto-scroll)
                const updatedMessages = [...this.messages];
                const existingMessage = updatedMessages[streamingMessageIndex];
                updatedMessages[streamingMessageIndex] = {
                  ...existingMessage,
                  text: pendingContent || '',
                  isStreaming: true
                };
                this.messages = updatedMessages;
              }

              this.cdr.detectChanges();
            });
          }, this.STREAM_THROTTLE_MS);
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
            // Message was created during streaming - update it
            const updatedMessages = [...this.messages];
            const existingMessage = updatedMessages[streamingMessageIndex];
            updatedMessages[streamingMessageIndex] = {
              ...existingMessage,
              text: existingMessage.text || pendingContent,
              isStreaming: false,
              isPartial: false
            };
            this.messages = updatedMessages;
            this.cdr.detectChanges();
          } else if (pendingContent && pendingContent.trim().length > 0) {
            // Message was never created during streaming - create it now
            this.isLoading = false;
            this.messages = [...this.messages, {
              id: `streaming-${Date.now()}`,
              text: pendingContent,
              isUser: false,
              timestamp: new Date(),
              role: MessageRoleTypes.Assistant,
              isStreaming: false
            }];
            this.cdr.detectChanges();
            this.scrollToBottom();
          }

          this.isStreamingActive = false;
          this.activeStream = null;

          // Focus the input after completion (desktop only)
          if (!this.isMobile) {
            setTimeout(() => this.focusInput(), this.FOCUS_INPUT_DELAY_MS);
          }
        });
      },
      (error: any) => {
        // Stream error - clean up timeout and streaming state
        if (this.streamUpdateTimeout) {
          clearTimeout(this.streamUpdateTimeout);
          this.streamUpdateTimeout = null;
        }

        this.isLoading = false;
        this.isStreamingActive = false;
        this.activeStream = null;

        // Check if message was removed by user cancellation
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

        this.cdr.detectChanges();
        // Focus input on error (desktop only)
        if (!this.isMobile) {
          this.focusInput();
        }
      }
    );
  }

  // Handle keydown events for textarea
  onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      if (this.isMobile) {
        // Mobile: Only send with Ctrl/Cmd + Enter (default Enter creates new line)
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          this.sendMessage();
        }
      } else {
        // Desktop: Enter sends message, Shift + Enter creates new line
        if (!e.shiftKey) {
          e.preventDefault();
          this.sendMessage();
        }
        // Shift + Enter allows default behavior (new line)
      }
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
  
  private async scrollToBottom() {
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


  // Create an empty food selection card for manual entry
  // Opens with quick search mode by default, showing all 4 mode options
  async createManualFoodEntry(): Promise<void> {
    try {
      // Track FAB click analytics
      this.analytics.trackActionClick('fab_add_food', 'chat_page');

      // Call backend immediately to create the message
      const request = new UpdateMealSelectionRequest({
        messageId: undefined, // No ID yet - backend will create
        localDateKey: this.selectedDate,
        foods: []
      });

      const response = await this.apiService.updateMealSelection(request).toPromise();

      if (response?.isSuccess && response.messageId) {
        // Create the UI message with the returned messageId
        // autoOpenQuickAdd flag tells food-selection to default to quick search mode with input visible
        const newMessage: DisplayMessage = {
          id: response.messageId, // Use the real ID from backend
          text: '',
          isUser: false,
          timestamp: new Date(),
          role: MessageRoleTypes.PendingFoodSelection,
          mealSelection: new MealSelection({
            mealName: 'Food Entry',
            foods: []
          }),
          mealName: 'Food Entry',
          isStreaming: false,
          isPartial: false,
          autoOpenQuickAdd: true // Opens card with search input visible and mode selector showing all 4 options
        };

        // Add to messages array
        this.messages = [...this.messages, newMessage];

        // Scroll to bottom to show new card
        setTimeout(() => {
          this.content.scrollToBottom(300);
        }, 100);
      } else {
        this.toastService.showToast({
          message: 'Failed to create food entry',
          color: 'danger',
          duration: 2000
        });
      }
    } catch (error) {
      console.error('Error creating manual food entry:', error);
      this.toastService.showToast({
        message: 'Failed to create food entry',
        color: 'danger',
        duration: 2000
      });
    }
  }

  // Focus the input element
  private focusInput() {
    // Don't refocus if the most recent message is a food selection card
    // This prevents annoying refocus during food logging, but allows refocus
    // if user sends a new message while an older food card is still visible
    const lastMessage = this.messages[this.messages.length - 1];
    const isLastMessageFoodSelection = lastMessage &&
      (lastMessage.role === MessageRoleTypes.PendingFoodSelection ||
       lastMessage.role === MessageRoleTypes.PendingEditFoodSelection);

    if (isLastMessageFoodSelection) {
      return; // Skip refocusing when the most recent message is a food selection card
    }

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
            role: msg.role,
            retryCount: msg.retryCount,
            createdDateUtc: msg.createdDateUtc,
            lastUpdatedDateUtc: msg.lastUpdatedDateUtc
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

    // Focus the input after cancellation (desktop only)
    if (!this.isMobile) {
      this.focusInput();
    }
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

  /**
   * Handle share meal button click from food-selection component
   * Creates a shareable link for the completed meal entry
   */
  async onShareMeal(message: DisplayMessage): Promise<void> {
    try {
      // Ensure we have a food entry ID to share
      const foodEntryId = message.mealSelection?.foodEntryId;
      if (!foodEntryId) {
        this.toastService.showToast({
          message: 'Cannot share this meal - no food entry found',
          color: 'danger'
        });
        return;
      }

      // Create share request
      const request = new CreateSharedMealRequest({ foodEntryId });
      const response = await this.apiService.createSharedMeal(request).toPromise();

      if (!response?.isSuccess) {
        this.toastService.showToast({
          message: 'Failed to create share link',
          color: 'danger'
        });
        return;
      }

      // Extract meal name for modal display
      const mealName = message.mealName || message.mealSelection?.mealName || 'Food Entry';

      // Open share modal with QR code and copy link functionality
      const modal = await this.modalController.create({
        component: ShareMealModalComponent,
        componentProps: {
          shareUrl: response.shareUrl,
          mealName: mealName,
          expiresDate: response.expiresDateUtc
        },
        cssClass: 'share-meal-modal'
      });

      await modal.present();

      // Track analytics event
      this.analytics.trackEvent('meal_shared', {
        mealName: mealName,
        shareToken: response.shareToken,
        source: 'chat'
      });
    } catch (error) {
      console.error('Error sharing meal:', error);
      this.toastService.showToast({
        message: 'Failed to share meal',
        color: 'danger'
      });
    }
  }

  // Helper: Check if a message represents an incomplete meal (never completed)
  private hasIncompleteMeal(message: DisplayMessage): boolean {
    const debugInfo = {
      messageId: message.id,
      role: message.role,
      roleType: MessageRoleTypes[message.role!],
      mealSelection: message.mealSelection,
      hasMealSelection: !!message.mealSelection,
      foodEntryId: message.mealSelection?.foodEntryId,
      sharedById: message.mealSelection?.sharedById
    };

    // Only PendingFoodSelection messages can be incomplete
    if (message.role !== MessageRoleTypes.PendingFoodSelection &&
        message.role !== MessageRoleTypes.PendingEditFoodSelection) {
      return false;
    }

    // If there's no mealSelection at all, it's incomplete
    if (!message.mealSelection) {
      return true;
    }

    // If this is a shared meal (has sharedById), it's never incomplete - just needs to be saved
    if (message.mealSelection.sharedById) {
      return false;
    }

    // If mealSelection has a foodEntryId, it was completed/saved
    if (message.mealSelection.foodEntryId) {
      return false;
    }

    // Check if this is a meal with complete data (no pending servings)
    // These don't have foodEntryId but should have complete food data
    const hasCompleteData = message.mealSelection.foods?.every(food =>
      food.components?.every(component =>
        component.matches?.every(match =>
          match.servings?.every(serving => !serving.isPending) && !match.isPending
        )
      )
    );

    if (hasCompleteData) {
      return false;
    }

    // No foodEntryId and incomplete data means it's truly incomplete
    return true;
  }

  // Helper: Find the original user message that started this meal selection
  private findOriginalMealMessage(pendingMessage: DisplayMessage): DisplayMessage | null {
    if (!pendingMessage.id) {
      return null;
    }

    // Find the pending message index
    const pendingIndex = this.messages.findIndex(m => m.id === pendingMessage.id);
    if (pendingIndex === -1) {
      return null;
    }

    // Search backwards to find the most recent user message before this pending message
    for (let i = pendingIndex - 1; i >= 0; i--) {
      if (this.messages[i].isUser && this.messages[i].role === MessageRoleTypes.User) {
        return this.messages[i];
      }
    }

    return null;
  }

  // Handle incomplete meal - simply retry it
  // Backend handles all cleanup logic (retry limits, time windows, error messages, deletions)
  private async handleIncompleteMeal(incompleteMealMessage: DisplayMessage): Promise<void> {
    this.isRetrying = true;

    try {

      // Find the original user message to retry
      const originalMessage = this.findOriginalMealMessage(incompleteMealMessage);
      if (!originalMessage || !originalMessage.text) {
        return;
      }

      // Remove incomplete message from UI
      const incompleteMsgIndex = this.messages.findIndex(m => m.id === incompleteMealMessage.id);
      if (incompleteMsgIndex !== -1) {
        this.messages.splice(incompleteMsgIndex, 1);
        if (incompleteMealMessage.id) {
          this.cancelledMessageIds.add(incompleteMealMessage.id);
        }
      }

      // Remove user message from UI (will be re-added by sendMessage)
      const userMsgIndex = this.messages.findIndex(m => m.id === originalMessage.id);
      if (userMsgIndex !== -1) {
        this.messages.splice(userMsgIndex, 1);
        if (originalMessage.id) {
          this.cancelledMessageIds.add(originalMessage.id);
        }
      }

      this.cdr.detectChanges();

      // Close any active stream
      if (this.activeStream) {
        this.activeStream.close();
        this.activeStream = null;
      }

      // Retry by calling sendMessage with the original text
      this.userMessage = originalMessage.text;
      await this.sendMessage();

    } finally {
      this.isRetrying = false;
    }
  }

  private async handleSharedMeal(shareToken: string) {

    try {
      // Fetch the shared meal from backend
      const localDateKey = this.dateService.getSelectedDate(); // Today's date in user's local timezone
      const request = new GetSharedMealRequest({
        shareToken,
        localDateKey
      });

      const response = await this.apiService.getSharedMeal(request).toPromise();
     
      if (!response?.isSuccess || response.isExpired) {
       
        this.toastService.showToast({
          message: 'This shared meal has expired or is no longer available',
          color: 'warning'
        });
        return;
      }

      if (!response.mealData) {
       
        this.toastService.showToast({
          message: 'Failed to load shared meal',
          color: 'danger'
        });
        return;
      }

     
      // Backend has already created the PendingFoodSelection message in the database
      // Show success toast
      const mealName = response.mealData.mealName || 'Meal';
      this.toastService.showToast({
        message: `"${mealName}" has been added to your chat!`,
        color: 'success',
        duration: 3000
      });

      // Track analytics
      this.analytics.trackEvent('shared_meal_imported', {
        mealName: mealName,
        sharedByAccountId: response.sharedByAccountId
      });

      // Skip auto-retry on next loadChatHistory to prevent retrying old incomplete meals
      this.skipNextAutoRetry = true;

    } catch (error) {
     
      this.toastService.showToast({
        message: 'Failed to load shared meal',
        color: 'danger'
      });
    }
  }

}

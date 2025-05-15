import { Component, OnInit, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonFooter, IonToolbar, IonInput, IonButton, IonIcon, IonSpinner, IonText } from '@ionic/angular/standalone';
import { AppHeaderComponent } from '../../components/header/header.component';
import { ChatMessageComponent } from '../../components/chat-message/chat-message.component';
import { addIcons } from 'ionicons';
import { paperPlaneOutline } from 'ionicons/icons';
import { AccountsService } from '../../services/accounts.service';
import { AuthService } from '../../services/auth.service';
import { ChatService } from '../../services/chat.service';
import { DateService } from '../../services/date.service';
import { 
  ChatMessage,
  BotMessageResponse,
  LogChatMessageResponse,
  GetChatMessagesResponse
} from '../../services/nutrition-ambition-api.service';
import { catchError, finalize, of, Subscription } from 'rxjs';
import { Router } from '@angular/router';

interface DisplayMessage {
  text: string;
  isUser: boolean;
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
    IonText,
    AppHeaderComponent,
    ChatMessageComponent
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
  private dateSubscription: Subscription;
  private hasPromptedForGoal: boolean = false;
  
  @ViewChild(IonContent, { static: false }) content: IonContent;
  @ViewChild('chatContent') chatContent!: ElementRef;

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
    
    // Get the current user email
    this.authService.userEmail$.subscribe(email => {
      this.userEmail = email;
      
      // If a user is logged in, check if they need a daily goal prompt
      if (email && this.dateService.isToday(new Date(this.selectedDate)) && !this.hasPromptedForGoal) {
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
    this.chatService.checkAndPromptForDailyGoal(accountId).subscribe({
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
    // Clean up subscription
    if (this.dateSubscription) {
      this.dateSubscription.unsubscribe();
    }
  }

  ngAfterViewInit() {
    // Scroll to bottom when view is initialized
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
      // Optional: navigate somewhere or reload
      window.location.reload();
    });
  }

  loadChatHistory(date: Date) {
    // Reset current messages
    this.messages = [];
    this.isLoadingHistory = true;
    this.error = null;
    this.hasPromptedForGoal = false; // Reset prompt flag when changing dates
    
    console.log('[DEBUG] Loading chat history for date:', date);
    
    // Check if we have an account ID
    const accountId = this.accountService.getAccountId();
    
    if (!accountId) {
      // No account, show welcome message
      this.isLoadingHistory = false;
      console.log('[DEBUG] No account ID, showing welcome message in UI only');
      const welcomeMessage = this.chatService.getFirstTimeWelcomeMessage();
      
      // Add the welcome message to UI only - don't log to backend for anonymous users
      // unless they interact with the chat
      this.messages.push({ 
        text: welcomeMessage, 
        isUser: false, 
        timestamp: new Date() 
      });
      this.scrollToBottom();
      return;
    }

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
          if (this.dateService.isToday(date) && this.userEmail && !this.hasPromptedForGoal) {
            this.promptForDailyGoalIfNeeded();
          }
        })
      )
      .subscribe({
        next: (response: GetChatMessagesResponse | null) => {
          if (response && response.isSuccess && response.messages && response.messages.length > 0) {
            // Convert API messages to display messages
            console.log('[DEBUG] Received chat history, message count:', response.messages.length);
            this.messages = response.messages.map(msg => ({
              text: msg.content || '',
              isUser: msg.role === 0, // 0 = User, 1 = Assistant
              timestamp: msg.loggedDateUtc || new Date()
            }));
            
            // Check if any messages already contain a goal prompt
            this.hasPromptedForGoal = this.messages.some(msg => 
              !msg.isUser && 
              msg.text.includes("set up personalized nutrition goals") && 
              msg.text.includes("age, sex, height, and weight")
            );
            
            this.scrollToBottom();
          } else if (this.dateService.isToday(date)) {
            // No messages for today, start a new conversation
            console.log('[DEBUG] No messages for today, starting new conversation');
            this.startConversation();
          }
        }
      });
  }

  startConversation() {
    // Only call this when there are no messages and it's today's date
    console.log('[DEBUG] Starting conversation with initial message');
    this.chatService.getInitialMessage().subscribe({
      next: (response: BotMessageResponse) => {
        if (response.isSuccess && response.message) {
          console.log('[DEBUG] Received initial message:', response.message);
          
          // Add message to UI display only
          // The welcome message should already be logged by the backend
          // during the getInitialMessage call
          this.messages.push({ 
            text: response.message, 
            isUser: false, 
            timestamp: new Date() 
          });
          this.scrollToBottom();
          
          console.log('[DEBUG] Initial message response object:', response);
        }
      },
      error: (error) => {
        console.error('Error getting initial message:', error);
        this.error = 'Unable to start conversation. Please try again later.';
      }
    });
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
    
    // Scroll to the bottom
    this.scrollToBottom();
    
    // Use the new sendMessage method that doesn't duplicate logs
    // The backend will log both the user message and assistant response
    console.log('[DEBUG] Sending message without duplicate logging:', sentMessage);
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
          this.scrollToBottom();
          
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
        this.scrollToBottom();
      }
    });
  }
  
  private scrollToBottom() {
    setTimeout(() => {
      // Try using the ElementRef first for smooth scrolling
      if (this.chatContent?.nativeElement) {
        try {
          this.chatContent.nativeElement.scrollTo({ 
            top: this.chatContent.nativeElement.scrollHeight, 
            behavior: 'smooth' 
          });
        } catch (err) {
          // Fallback if smooth scrolling not supported
          this.chatContent.nativeElement.scrollTop = this.chatContent.nativeElement.scrollHeight;
        }
      }
      
      // Also use IonContent as a backup method
      if (this.content) {
        this.content.scrollToBottom(300);
      }
    }, 50);
  }
} 
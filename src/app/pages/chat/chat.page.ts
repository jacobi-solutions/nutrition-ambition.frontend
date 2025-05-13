import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonFooter, IonToolbar, IonInput, IonButton, IonIcon } from '@ionic/angular/standalone';
import { AppHeaderComponent } from '../../components/app-header/app-header.component';
import { addIcons } from 'ionicons';
import { paperPlaneOutline } from 'ionicons/icons';
import { AccountsService } from '../../services/accounts.service';
import { AuthService } from '../../services/auth.service';
import { ChatService } from '../../services/chat.service';
import { 
  ChatMessage,
  BotMessageResponse,
  LogChatMessageResponse
} from '../../services/nutrition-ambition-api.service';

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
    AppHeaderComponent
  ]
})
export class ChatPage implements OnInit {
  messages: DisplayMessage[] = [];
  userMessage: string = '';
  isLoading: boolean = false;
  hasLoggedFirstMeal: boolean = false;

  constructor(
    private chatService: ChatService,
    private accountService: AccountsService,
    private authService: AuthService
  ) {
    // Add the icons explicitly to the library
    addIcons({ paperPlaneOutline });
  }

  async ngOnInit() {
    // Initial bot message
    if (!this.accountService.getAccountId()) {
      const welcomeMessage = this.chatService.getFirstTimeWelcomeMessage();
      this.messages.push({ 
        text: welcomeMessage, 
        isUser: false, 
        timestamp: new Date() 
      });
    } else {
      this.chatService.getInitialMessage().subscribe((response: BotMessageResponse) => {
        if (response.isSuccess && response.message) {
          this.messages.push({ 
            text: response.message, 
            isUser: false, 
            timestamp: new Date() 
          });
        }
      });
    }

    // Check anonymous sessions
    const sessions = this.accountService.incrementAnonymousSessionCount();
    if (sessions >= 3 && this.accountService.getAccountId() && !this.authService.isAuthenticated()) {
      this.chatService.getAnonymousWarning().subscribe((response: BotMessageResponse) => {
        if (response.isSuccess && response.message) {
          this.messages.push({ 
            text: response.message, 
            isUser: false, 
            timestamp: new Date() 
          });
        }
      });
    }
  }

  sendMessage() {
    if (!this.userMessage.trim()) return;
    
    // Save message and add to chat
    const sentMessage = this.userMessage;
    this.messages.push({
      text: sentMessage,
      isUser: true,
      timestamp: new Date()
    });
    
    // Clear input and show loading
    this.userMessage = '';
    this.isLoading = true;
    
    // Call API service
    this.chatService.logMessage(sentMessage).subscribe({
      next: (response: LogChatMessageResponse) => {
        this.isLoading = false;
        if (response.isSuccess && response.message?.content) {
          this.messages.push({
            text: response.message.content,
            isUser: false,
            timestamp: new Date()
          });

          // After the meal is saved to DB
          if (!this.hasLoggedFirstMeal) {
            this.hasLoggedFirstMeal = true;
            this.chatService.getPostLogHint(true).subscribe((hintResponse: BotMessageResponse) => {
              if (hintResponse.isSuccess && hintResponse.message) {
                this.messages.push({ 
                  text: hintResponse.message, 
                  isUser: false, 
                  timestamp: new Date() 
                });
              }
            });
          }
        }
      },
      error: (error: any) => {
        this.isLoading = false;
        this.messages.push({
          text: "Something went wrong. Please try again later.",
          isUser: false,
          timestamp: new Date()
        });
        console.error('Error sending message:', error);
      }
    });
  }
} 
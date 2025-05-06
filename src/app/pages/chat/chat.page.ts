import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonFooter, IonToolbar, IonInput, IonButton, IonIcon } from '@ionic/angular/standalone';
import { AppHeaderComponent } from '../../components/app-header/app-header.component';
import { addIcons } from 'ionicons';
import { paperPlaneOutline } from 'ionicons/icons';

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
  messages: any[] = [];
  userMessage: string = '';
  isLoading: boolean = false;

  constructor() {
    // Add the icons explicitly to the library
    addIcons({ paperPlaneOutline });
  }

  ngOnInit() {
    // Add a welcome message
    this.messages.push({
      text: 'Welcome to NutritionAmbition! How can I help you with your nutrition goals today?',
      isUser: false,
      timestamp: new Date()
    });
  }

  sendMessage() {
    if (!this.userMessage.trim()) return;
    
    // Add user message to the chat
    this.messages.push({
      text: this.userMessage,
      isUser: true,
      timestamp: new Date()
    });
    
    // Clear input and show loading
    const sentMessage = this.userMessage;
    this.userMessage = '';
    this.isLoading = true;
    
    // Simulate response (would be replaced with actual API call)
    setTimeout(() => {
      this.isLoading = false;
      this.messages.push({
        text: `I received your message: "${sentMessage}". I'll help you with that soon.`,
        isUser: false,
        timestamp: new Date()
      });
    }, 1000);
  }
} 
import { Component, Input, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';
import { IonText } from '@ionic/angular/standalone';
import { FoodSelectionComponent, UserSelectedServingRequest } from '../food-selection/food-selection.component';
import { ChatService } from '../../services/chat.service';
import { ChatMessage, BotMessageResponse, SelectableFoodMatch } from '../../services/nutrition-ambition-api.service';

@Component({
  selector: 'app-chat-message',
  templateUrl: './chat-message.component.html',
  styleUrls: ['./chat-message.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FoodSelectionComponent
  ]
})
export class ChatMessageComponent implements OnInit {
  @Input() text: string = '';
  @Input() isUser: boolean = false;
  @Input() isTool: boolean = false;
  @Input() timestamp: Date = new Date();
  @Input() message?: ChatMessage; // Message object with id
  @Input() foodOptions: Record<string, SelectableFoodMatch[]> | null = null;
  @Input() role?: string;

  showFoodSelector = true;

  constructor(
    private sanitizer: DomSanitizer,
    private chatService: ChatService
  ) {}

  ngOnInit() {
    console.log('🟡 ChatMessageComponent initialized with foodOptions:', this.foodOptions);
    this.showFoodSelector = true;
  }

  /**
   * Converts the message content to Markdown and sanitizes it
   * to prevent XSS attacks
   */
  get formattedContent(): SafeHtml {
    if (!this.text) return this.sanitizer.bypassSecurityTrustHtml('');
    
    // Only apply markdown formatting to bot and tool messages
    if (this.isUser) {
      return this.sanitizer.bypassSecurityTrustHtml(this.text);
    }

    // Convert Markdown to HTML and sanitize it
    const htmlContent = marked.parse(this.text);
    return this.sanitizer.bypassSecurityTrustHtml(htmlContent as string);
  }

  /**
   * Check if message has food selection payload
   */
  hasFoodSelection(): boolean {
    var hasFoodSelection = !!(this.foodOptions && Object.keys(this.foodOptions).length > 0);

    return hasFoodSelection;
  }
  
  foodSelectionPayload(): Record<string, SelectableFoodMatch[]> {
    return this.foodOptions!;
  }

  /**
   * Handle food selection confirmation
   */
  onSelectionConfirmed(selections: UserSelectedServingRequest[]): void {
    console.log('Food selections confirmed:', selections);
    
    // Call the chat service to submit the selections
    this.chatService.submitServingSelection(selections).subscribe({
      next: (response) => {
        console.log('Selection submission successful:', response);
        console.log('Submitted selections:', selections);
        
        // Hide the food selector UI
        this.showFoodSelector = false;
      },
      error: (error) => {
        console.error('Error submitting food selections:', error);
        // Keep the selector visible if submission failed
      }
    });
  }
} 
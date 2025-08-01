import { Component, Input, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';
import { IonText } from '@ionic/angular/standalone';
import { FoodSelectionComponent, UserSelectedServingRequest } from '../food-selection/food-selection.component';
import { ChatService } from '../../services/chat.service';
import { ChatMessage, BotMessageResponse, RankedFatSecretFood } from '../../services/nutrition-ambition-api.service';

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
  @Input() rankedFoodOptions?: Record<string, RankedFatSecretFood[]> | null = null;

  showFoodSelector = true;
  private chatService = inject(ChatService);

  constructor(private sanitizer: DomSanitizer) {}

  ngOnInit() {
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
  get hasFoodSelection(): boolean {
    return Object.keys(this.rankedFoodOptions || {}).length > 0;
  }
  
  get foodSelectionPayload(): Record<string, RankedFatSecretFood[]> | undefined {
    return this.hasFoodSelection ? this.rankedFoodOptions ?? undefined : undefined;
  }

  /**
   * Handle food selection confirmation
   */
  onSelectionConfirmed(selections: UserSelectedServingRequest[]): void {
    if (this.message?.id) {
      this.chatService.submitServingSelection(this.message.id, selections);
      this.showFoodSelector = false;
    }
  }
} 
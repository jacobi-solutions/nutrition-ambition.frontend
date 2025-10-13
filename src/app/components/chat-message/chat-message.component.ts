import { Component, Input, inject, SecurityContext } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';
import { IonText } from '@ionic/angular/standalone';
import { ChatMessage, ComponentMatch } from '../../services/nutrition-ambition-api.service';

@Component({
  selector: 'app-chat-message',
  templateUrl: './chat-message.component.html',
  styleUrls: ['./chat-message.component.scss'],
  standalone: true,
  imports: [
    CommonModule
  ]
})
export class ChatMessageComponent {
  @Input() text: string = '';
  @Input() isUser: boolean = false;
  @Input() isTool: boolean = false;
  @Input() timestamp: Date = new Date();
  @Input() message?: ChatMessage; // Message object with id
  @Input() role?: string;
  @Input() isStreaming: boolean = false;

  constructor(
    private sanitizer: DomSanitizer
  ) {}


  /**
   * Converts the message content to Markdown and sanitizes it properly
   * to prevent XSS attacks
   */
  get formattedContent(): SafeHtml {
    if (!this.text) return '';

    if (this.isUser) {
      // For user messages: escape HTML but preserve line breaks
      const escaped = this.text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\n/g, '<br>');

      // Use sanitize instead of bypassSecurityTrustHtml
      return this.sanitizer.sanitize(SecurityContext.HTML, escaped) || '';
    }

    // For bot messages: convert markdown and sanitize
    const htmlContent = marked.parse(this.text) as string;

    // Use sanitize instead of bypassSecurityTrustHtml
    return this.sanitizer.sanitize(SecurityContext.HTML, htmlContent) || '';
  }
} 
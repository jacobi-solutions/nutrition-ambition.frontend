import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';
import { IonText } from '@ionic/angular/standalone';

@Component({
  selector: 'app-chat-message',
  templateUrl: './chat-message.component.html',
  styleUrls: ['./chat-message.component.scss'],
  standalone: true,
  imports: [
    CommonModule
  ]
})
export class ChatMessageComponent implements OnInit {
  @Input() text: string = '';
  @Input() isUser: boolean = false;
  @Input() isTool: boolean = false;
  @Input() timestamp: Date = new Date();

  constructor(private sanitizer: DomSanitizer) {}

  ngOnInit() {}

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
} 
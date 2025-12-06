import { Component, Input, SecurityContext, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { marked } from 'marked';
import { ChatMessage } from '../../services/nutrition-ambition-api.service';

/** Represents an action button extracted from markdown links */
interface ActionLink {
  label: string;
  path: string;
}

@Component({
  selector: 'app-chat-message',
  templateUrl: './chat-message.component.html',
  styleUrls: ['./chat-message.component.scss'],
  standalone: true,
  imports: [
    CommonModule
  ]
})
export class ChatMessageComponent implements OnChanges {
  @Input() text: string = '';
  @Input() isUser: boolean = false;
  @Input() isTool: boolean = false;
  @Input() timestamp: Date = new Date();
  @Input() message?: ChatMessage; // Message object with id
  @Input() role?: string;
  @Input() isStreaming: boolean = false;
  @Input() hasActionButtons: boolean = false;

  // Routes that should be rendered as action buttons
  private readonly actionRoutes = ['/signup', '/account-management'];

  // Extracted action buttons - rendered as real Angular buttons in template
  actionLinks: ActionLink[] = [];

  // Processed content without the action link markdown
  processedHtml: SafeHtml = '';

  constructor(
    private sanitizer: DomSanitizer,
    public router: Router  // Public so template can access it
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['text'] || changes['hasActionButtons'] || changes['message']) {
      this.processContent();
    }
  }

  /**
   * Process the message content:
   * 1. Extract action links into actionLinks array (rendered as real Angular buttons)
   * 2. Convert remaining text to HTML via Markdown
   */
  private processContent(): void {
    if (!this.text) {
      this.processedHtml = '';
      this.actionLinks = [];
      return;
    }

    if (this.isUser) {
      // For user messages: escape HTML but preserve line breaks
      const escaped = this.text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\n/g, '<br>');

      this.processedHtml = this.sanitizer.sanitize(SecurityContext.HTML, escaped) || '';
      this.actionLinks = [];
      return;
    }

    // For bot messages: extract action links, then render remaining as markdown
    let processedText = this.text;
    this.actionLinks = [];

    const shouldExtractButtons = this.hasActionButtons || this.message?.hasActionButtons;

    if (shouldExtractButtons) {
      // Extract all action links and remove them from the text
      // Use matchAll instead of exec loop to avoid modifying while iterating
      const linkPattern = /\[([^\]]+)\]\((\/[^)]+)\)/g;
      const matches = [...this.text.matchAll(linkPattern)];

      for (const match of matches) {
        const [fullMatch, label, path] = match;
        // Only extract if it's one of our action routes
        if (this.actionRoutes.some(route => path === route || path.startsWith(route + '?'))) {
          this.actionLinks.push({ label, path });
          // Remove this link from the processed text
          processedText = processedText.replace(fullMatch, '');
        }
      }

      // Clean up whitespace artifacts from removed links
      processedText = processedText
        .replace(/\s{2,}/g, ' ')         // collapse multiple spaces
        .replace(/\s+([.,!?])/g, '$1')   // remove space before punctuation
        .trim();
    }

    const htmlContent = marked.parse(processedText) as string;
    this.processedHtml = this.sanitizer.sanitize(SecurityContext.HTML, htmlContent) || '';
  }

  /**
   * Navigate to the action link path
   */
  onActionClick(path: string): void {
    this.router.navigateByUrl(path);
  }
} 
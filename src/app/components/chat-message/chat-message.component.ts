import { Component, Input, SecurityContext, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { marked } from 'marked';
import { ChatMessage } from '../../services/nutrition-ambition-api.service';

@Component({
  selector: 'app-chat-message',
  templateUrl: './chat-message.component.html',
  styleUrls: ['./chat-message.component.scss'],
  standalone: true,
  imports: [
    CommonModule
  ]
})
export class ChatMessageComponent implements OnInit, OnDestroy {
  @Input() text: string = '';
  @Input() isUser: boolean = false;
  @Input() isTool: boolean = false;
  @Input() timestamp: Date = new Date();
  @Input() message?: ChatMessage; // Message object with id
  @Input() role?: string;
  @Input() isStreaming: boolean = false;
  @Input() hasActionButtons: boolean = false;

  // Routes that should be rendered as action buttons
  private readonly actionRoutes = ['/signup', '/login', '/account-management', '/settings'];
  private clickHandler: ((e: MouseEvent | TouchEvent) => void) | null = null;

  constructor(
    private sanitizer: DomSanitizer,
    private router: Router
  ) {}

  ngOnInit() {
    // Use mousedown/touchend instead of click - Ionic's gesture system can intercept click events
    // on dynamically injected content within ion-content scroll containers
    this.clickHandler = (e: MouseEvent | TouchEvent) => {
      const target = (e instanceof TouchEvent ? e.target : e.target) as HTMLElement;
      if (target.classList.contains('action-button')) {
        e.preventDefault();
        e.stopPropagation();
        const href = target.getAttribute('data-href');
        if (href) {
          this.router.navigateByUrl(href);
        }
      }
    };
    document.addEventListener('mousedown', this.clickHandler, true);
    document.addEventListener('touchend', this.clickHandler, true);
  }

  ngOnDestroy() {
    if (this.clickHandler) {
      document.removeEventListener('mousedown', this.clickHandler, true);
      document.removeEventListener('touchend', this.clickHandler, true);
    }
  }

  /**
   * Converts markdown action links to styled buttons for messages with hasActionButtons flag.
   * Only processes specific internal routes to avoid affecting external links.
   */
  private convertActionLinksToButtons(text: string): string {
    // Regex to match markdown links: [text](path)
    const linkPattern = /\[([^\]]+)\]\((\/[^)]+)\)/g;

    return text.replace(linkPattern, (match, linkText, linkPath) => {
      // Only convert if it's one of our action routes
      if (this.actionRoutes.some(route => linkPath === route || linkPath.startsWith(route + '?'))) {
        // Use button instead of anchor to avoid Ionic's anchor interception
        return `<button type="button" class="action-button" data-href="${linkPath}">${linkText}</button>`;
      }
      return match;
    });
  }


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

    // For bot messages: optionally convert action links to buttons, then markdown
    let processedText = this.text;

    // Check hasActionButtons from input or message object
    const shouldRenderButtons = this.hasActionButtons || this.message?.hasActionButtons;

    // Only convert action links if the message has the hasActionButtons flag
    if (shouldRenderButtons) {
      processedText = this.convertActionLinksToButtons(processedText);
    }

    const htmlContent = marked.parse(processedText) as string;

    // For messages with action buttons, we need to bypass security to preserve the button HTML
    // This is safe because we control the button HTML generation in convertActionLinksToButtons
    if (shouldRenderButtons) {
      return this.sanitizer.bypassSecurityTrustHtml(htmlContent);
    }

    // Use sanitize for normal messages
    return this.sanitizer.sanitize(SecurityContext.HTML, htmlContent) || '';
  }
} 
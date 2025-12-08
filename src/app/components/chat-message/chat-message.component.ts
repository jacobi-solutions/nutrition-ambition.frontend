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
    console.log('[ChatMessage] processContent called, text length:', this.text?.length, 'hasActionButtons:', this.hasActionButtons, 'message?.hasActionButtons:', this.message?.hasActionButtons);
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
    console.log('[ChatMessage] shouldExtractButtons:', shouldExtractButtons);

    if (shouldExtractButtons) {
      // Extract all action links and remove them from the text
      // Collect matches first to avoid modifying while iterating
      const linkPattern = /\[([^\]]+)\]\((\/[^)]+)\)/g;
      const matches: { fullMatch: string; label: string; path: string }[] = [];
      let match: RegExpExecArray | null;

      while ((match = linkPattern.exec(this.text)) !== null) {
        matches.push({ fullMatch: match[0], label: match[1], path: match[2] });
      }

      console.log('[ChatMessage] Found', matches.length, 'link matches in text');
      for (const m of matches) {
        console.log('[ChatMessage] Checking match:', m.path, 'against actionRoutes:', this.actionRoutes);
        // Only extract if it's one of our action routes
        if (this.actionRoutes.some(route => m.path === route || m.path.startsWith(route + '?'))) {
          console.log('[ChatMessage] Adding action link:', m.label, m.path);
          this.actionLinks.push({ label: m.label, path: m.path });
          // Remove this link from the processed text
          processedText = processedText.replace(m.fullMatch, '');
        }
      }
      console.log('[ChatMessage] Final actionLinks count:', this.actionLinks.length);

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
   * If navigating to signup or account-management, set flag to trigger conversation continuation after upgrade
   */
  onActionClick(path: string): void {
    console.log('[ChatMessage] onActionClick called with path:', path);
    // Navigate to the action path (signup, account-management, etc.)
    // Backend tracks conversation continuation via Account.NeedsContinuationAfterUpgrade flag
    this.router.navigateByUrl(path);
  }
} 
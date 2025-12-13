import { Component, Input, Output, EventEmitter, SecurityContext, OnChanges, SimpleChanges } from '@angular/core';
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
  private readonly actionRoutes = ['/signup', '/account-management', '/action/setup-goals', '/action/setup-preferences'];

  // Output event for action triggers that don't navigate (setup-goals, setup-preferences)
  @Output() actionTriggered = new EventEmitter<string>();

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
      // IMPORTANT: Only collapse multiple spaces on the same line, preserve newlines for markdown
      processedText = processedText
        .replace(/ {2,}/g, ' ')           // collapse multiple spaces (not newlines!)
        .replace(/ +([.,!?])/g, '$1')     // remove space before punctuation
        .replace(/\n{3,}/g, '\n\n')       // collapse more than 2 consecutive newlines to 2
        .trim();
    }

    let htmlContent = marked.parse(processedText) as string;

    // Wrap leading numbers in h3 tags with a span for styling (e.g., "1. " becomes "<span class="step-number">1.</span> ")
    htmlContent = htmlContent.replace(
      /<h3>(\d+)\.\s*/g,
      '<h3><span class="step-number">$1.</span> '
    );

    this.processedHtml = this.sanitizer.sanitize(SecurityContext.HTML, htmlContent) || '';
  }

  /**
   * Handle action link clicks
   * - For /action/* paths: emit event for parent to handle (triggers streaming endpoints)
   * - For other paths: navigate directly (signup, account-management)
   */
  onActionClick(path: string): void {
    console.log('[ChatMessage] onActionClick called with path:', path);

    // Check if this is an action trigger path (not a navigation path)
    if (path.startsWith('/action/')) {
      // Emit event for parent component to handle the streaming
      this.actionTriggered.emit(path);
      return;
    }

    // Navigate to the action path (signup, account-management, etc.)
    // Backend tracks conversation continuation via Account.NeedsContinuationAfterUpgrade flag
    this.router.navigateByUrl(path);
  }
} 
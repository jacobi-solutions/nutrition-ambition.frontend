import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ModalController } from '@ionic/angular';
import { Subject, takeUntil } from 'rxjs';
import { 
  FeedbackWithAccount, 
  ChatMessage,
  Account 
} from '../../../services/nutrition-ambition-api.service';
import { AdminService } from '../../services/admin.service';
import { ChatService } from '../../../services/chat.service';
import { DateService } from '../../../services/date.service';

@Component({
  selector: 'app-debug-view',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './debug-view.component.html',
  styleUrls: ['./debug-view.component.scss'],
})
export class DebugViewComponent implements OnInit, OnDestroy {
  @Input() feedbackWithAccount!: FeedbackWithAccount;
  
  chatMessages: ChatMessage[] = [];
  userProfile?: any; // TODO: Add UserProfile type when available
  userDailyTargets?: any; // TODO: Add DailyTarget type when available
  selectedDate: Date;
  
  // Resizing state
  leftPanelWidth = 30; // Percentage
  isResizing = false;
  startX = 0;
  startWidth = 0;
  mockLogs = [
    { timestamp: '09:31:42', level: 'info', message: 'User submitted feedback: food logging issue' },
    { timestamp: '09:31:40', level: 'debug', message: 'Chat message received from user' },
    { timestamp: '09:31:35', level: 'info', message: 'Food search performed: "chicken breast"' },
    { timestamp: '09:31:30', level: 'debug', message: 'User navigated to food entry page' },
    { timestamp: '09:30:15', level: 'info', message: 'User logged in successfully' },
    { timestamp: '09:30:12', level: 'debug', message: 'Authentication token validated' }
  ];

  private destroy$ = new Subject<void>();

  constructor(
    private modalController: ModalController,
    private adminService: AdminService,
    private chatService: ChatService,
    private dateService: DateService
  ) {
    this.selectedDate = this.dateService.getSelectedDateUtc();
  }

  ngOnInit() {
    this.loadUserChatMessages();
    // TODO: Load user profile and daily targets
    
    // Initialize the CSS custom property
    setTimeout(() => {
      const debugLayout = document.querySelector('.debug-layout') as HTMLElement;
      if (debugLayout) {
        debugLayout.style.setProperty('--left-panel-width', `${this.leftPanelWidth}%`);
      }
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async loadUserChatMessages() {
    if (!this.feedbackWithAccount?.accountId) return;

    try {
      const response = await this.adminService.getUserChatMessages(
        this.feedbackWithAccount.accountId,
        {
          loggedDateUtc: this.feedbackWithAccount.feedback?.createdDateUtc ? 
            new Date(this.feedbackWithAccount.feedback.createdDateUtc) : undefined,
          limit: 100
        }
      );

      if (response.isSuccess && response.messages) {
        this.chatMessages = response.messages.sort((a, b) => 
          new Date(a.createdDateUtc || 0).getTime() - new Date(b.createdDateUtc || 0).getTime()
        );
      }
    } catch (error) {
      console.error('[DebugView] Error loading chat messages:', error);
    }
  }

  // Note: dismiss method removed since this is now used in a page, not a modal

  trackByMessageId(index: number, message: ChatMessage): string {
    return message.id || index.toString();
  }

  formatTime(dateInput?: string | Date): string {
    if (!dateInput) return '';
    
    try {
      const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return '';
    }
  }

  formatDate(dateString?: string | Date): string {
    if (!dateString) return 'N/A';
    
    try {
      const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return 'Invalid Date';
    }
  }

  formatMessageContent(content?: string): string {
    if (!content) return '';
    
    // Basic formatting for better readability
    return content
      .replace(/\n/g, '<br>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>');
  }

  getTypeColor(feedbackType: string): string {
    switch (feedbackType) {
      case 'bug': return 'danger';
      case 'feature': return 'primary';
      case 'other': return 'medium';
      default: return 'medium';
    }
  }

  // Resizing methods
  onMouseDown(event: MouseEvent): void {
    this.isResizing = true;
    this.startX = event.clientX;
    this.startWidth = this.leftPanelWidth;
    event.preventDefault();
    
    // Add visual feedback
    const debugLayout = (event.target as HTMLElement).closest('.debug-layout') as HTMLElement;
    if (debugLayout) {
      debugLayout.classList.add('resizing');
    }
    
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }

  onMouseMove(event: MouseEvent): void {
    if (!this.isResizing) return;

    const containerWidth = (event.target as HTMLElement).closest('.debug-layout')?.clientWidth || window.innerWidth;
    const deltaX = event.clientX - this.startX;
    const deltaPercent = (deltaX / containerWidth) * 100;
    const newWidth = this.startWidth + deltaPercent;
    
    // Constrain the width between 15% and 50%
    this.leftPanelWidth = Math.min(Math.max(newWidth, 15), 50);
    
    // Update CSS custom property for real-time resizing
    const debugLayout = (event.target as HTMLElement).closest('.debug-layout') as HTMLElement;
    if (debugLayout) {
      debugLayout.style.setProperty('--left-panel-width', `${this.leftPanelWidth}%`);
    }
  }

  onMouseUp(): void {
    if (this.isResizing) {
      this.isResizing = false;
      
      // Remove visual feedback
      const debugLayout = document.querySelector('.debug-layout') as HTMLElement;
      if (debugLayout) {
        debugLayout.classList.remove('resizing');
      }
      
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
  }
}

import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ModalController, AlertController } from '@ionic/angular';
import { Subject, takeUntil } from 'rxjs';
import { Router } from '@angular/router';
import { 
  FeedbackWithAccount, 
  ChatMessage,
  Account,
  LogEntryDto 
} from '../../../services/nutrition-ambition-api.service';
import { AdminService } from '../../services/admin.service';
import { ChatService } from '../../../services/chat.service';
import { DateService } from '../../../services/date.service';
import { ToastService } from '../../../services/toast.service';

@Component({
  selector: 'app-debug-view',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './debug-view.component.html',
  styleUrls: ['./debug-view.component.scss']
})
export class DebugViewComponent implements OnInit, OnDestroy {
  @Input() feedbackWithAccount!: FeedbackWithAccount;
  
  chatMessages: ChatMessage[] = [];
  userProfile?: any; // TODO: Add UserProfile type when available
  userDailyTargets?: any; // TODO: Add DailyTarget type when available
  selectedDate: Date;
  systemLogs: LogEntryDto[] = [];
  logsLoading = false;
  
  // Resizing state
  leftPanelWidth = 30; // Percentage
  isResizing = false;
  startX = 0;
  startWidth = 0;

  private destroy$ = new Subject<void>();

  constructor(
    private modalController: ModalController,
    private adminService: AdminService,
    private chatService: ChatService,
    private dateService: DateService,
    private alertController: AlertController,
    private toastService: ToastService,
    private router: Router
  ) {
    this.selectedDate = this.dateService.getSelectedDateUtc();
  }

  ngOnInit() {
    this.loadUserChatMessages();
    this.loadSystemLogs();
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
          localDateKey: this.feedbackWithAccount.feedback?.createdDateUtc ? 
            new Date(this.feedbackWithAccount.feedback.createdDateUtc).toISOString().split('T')[0] : undefined,
          limit: 100
        }
      );

      if (response.isSuccess && response.messages) {
        this.chatMessages = response.messages.sort((a, b) => 
          new Date(a.createdDateUtc || 0).getTime() - new Date(b.createdDateUtc || 0).getTime()
        );
      }
    } catch (error) {
    }
  }

  async loadSystemLogs() {
    if (!this.feedbackWithAccount?.accountId) return;

    try {
      this.logsLoading = true;
      
      // Calculate time window based on feedback creation time
      let minutesBack = 60; // Default to 1 hour
      
      if (this.feedbackWithAccount.feedback?.createdDateUtc) {
        const feedbackTime = new Date(this.feedbackWithAccount.feedback.createdDateUtc);
        const now = new Date();
        const timeDiffMinutes = Math.floor((now.getTime() - feedbackTime.getTime()) / (1000 * 60));
        
        // Look from 30 minutes before feedback to 30 minutes after (or now if recent)
        const lookBackWindow = timeDiffMinutes + 30;
        minutesBack = Math.min(Math.max(lookBackWindow, 60), 60 * 24 * 7); // Cap at 7 days
        
      }

      const response = await this.adminService.searchLogs({
        accountId: this.feedbackWithAccount.accountId,
        email: this.feedbackWithAccount.accountEmail,
        minutesBack: minutesBack,
        pageSize: 50,
        severity: 'INFO' // Get info level and above
      });

      if (response.isSuccess && response.items) {
        this.systemLogs = response.items;
      } else {
      }
    } catch (error) {
    } finally {
      this.logsLoading = false;
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

  // Feedback action methods
  async markAsComplete() {
    const feedbackEntry = this.feedbackWithAccount?.feedback;
    if (!feedbackEntry) return;

    const alert = await this.alertController.create({
      header: 'Mark as Complete',
      message: 'Add a completion note (optional):',
      inputs: [
        {
          name: 'completionNote',
          type: 'textarea',
          placeholder: 'Describe what was done to resolve this feedback...',
          value: feedbackEntry.completionNote || ''
        }
      ],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Mark Complete',
          handler: async (data) => {
            try {
              await this.adminService.completeFeedback(
                feedbackEntry.id!, 
                true, 
                data.completionNote
              );
              await this.showToast('Feedback marked as complete', 'success');
              // Update local state
              if (this.feedbackWithAccount?.feedback) {
                this.feedbackWithAccount.feedback.isCompleted = true;
                this.feedbackWithAccount.feedback.completionNote = data.completionNote;
              }
            } catch (error) {
              await this.showToast('Error marking feedback as complete', 'danger');
            }
          }
        }
      ]
    });

    await alert.present();
  }

  async markAsIncomplete() {
    const feedbackEntry = this.feedbackWithAccount?.feedback;
    if (!feedbackEntry) return;

    const alert = await this.alertController.create({
      header: 'Mark as Incomplete',
      message: 'Are you sure you want to mark this feedback as incomplete?',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Mark Incomplete',
          handler: async () => {
            try {
              await this.adminService.completeFeedback(feedbackEntry.id!, false);
              await this.showToast('Feedback marked as incomplete', 'success');
              // Update local state
              if (this.feedbackWithAccount?.feedback) {
                this.feedbackWithAccount.feedback.isCompleted = false;
                this.feedbackWithAccount.feedback.completionNote = undefined;
              }
            } catch (error) {
              await this.showToast('Error marking feedback as incomplete', 'danger');
            }
          }
        }
      ]
    });

    await alert.present();
  }

  async deleteFeedback() {
    const feedbackEntry = this.feedbackWithAccount?.feedback;
    if (!feedbackEntry) return;

    const alert = await this.alertController.create({
      header: 'Delete Feedback',
      message: 'Are you sure you want to permanently delete this feedback entry?',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Delete',
          role: 'destructive',
          handler: async () => {
            try {
              const response = await this.adminService.deleteFeedback(feedbackEntry.id!);
              if (response.isSuccess) {
                await this.showToast('Feedback deleted successfully', 'success');
                // Navigate back to admin page
                await this.router.navigate(['/admin']);
              } else {
                await this.showToast('Error deleting feedback', 'danger');
              }
            } catch (error) {
              await this.showToast('Error deleting feedback', 'danger');
            }
          }
        }
      ]
    });

    await alert.present();
  }

  private async showToast(message: string, color: 'success' | 'danger' | 'warning' | 'medium' = 'medium') {
    await this.toastService.showToast({
      message,
      duration: 3000,
      color: 'medium'
    });
  }

  // Food selection methods
  isFoodSelectionMessage(role: string | undefined): boolean {
    return role === 'CompletedFoodSelection' || role === 'CompletedEditFoodSelection';
  }

  getFoodSelectionItems(mealSelection: any): any[] {
    if (!mealSelection?.foods) {
      return [];
    }

    const items: any[] = [];
    
    // Iterate through foods → components → matches
    mealSelection.foods.forEach((food: any) => {
      if (food.components) {
        food.components.forEach((component: any) => {
          if (component.matches && component.matches.length > 0) {
            const firstMatch = component.matches[0]; // Get the first/best match
            const selectedServing = firstMatch.servings?.find((serving: any) => 
              serving.servingId?.servingType === firstMatch.selectedServingId
            );

            if (selectedServing) {
              items.push({
                originalText: firstMatch.originalText || food.originalPhrase,
                displayName: firstMatch.displayName,
                brandName: firstMatch.brandName,
                displayQuantity: selectedServing.displayQuantity,
                displayUnit: selectedServing.displayUnit
              });
            }
          }
        });
      }
    });

    return items;
  }
}

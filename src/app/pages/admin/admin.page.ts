import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, AlertController, ToastController, ModalController } from '@ionic/angular';
import { Subject, takeUntil } from 'rxjs';
import { AccountsService } from '../../services/accounts.service';
import { AdminService } from '../../services/admin.service';
import { Account, FeedbackEntry } from '../../services/nutrition-ambition-api.service';
import { addIcons } from 'ionicons';
import { 
  analyticsOutline,
  chatbubblesOutline,
  eyeOutline,
  refreshOutline,
  filterOutline,
  checkmarkOutline,
  trashOutline,
  bugOutline,
  bulbOutline,
  helpOutline,
  documentOutline
} from 'ionicons/icons';

// Register all icons used in this component
addIcons({
  'analytics-outline': analyticsOutline,
  'chatbubbles-outline': chatbubblesOutline,
  'eye-outline': eyeOutline,
  'refresh-outline': refreshOutline,
  'filter-outline': filterOutline,
  'checkmark-outline': checkmarkOutline,
  'trash-outline': trashOutline,
  'bug-outline': bugOutline,
  'bulb-outline': bulbOutline,
  'help-outline': helpOutline,
  'document-outline': documentOutline
});

@Component({
  selector: 'app-admin',
  templateUrl: './admin.page.html',
  styleUrls: ['./admin.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule]
})
export class AdminPage implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  account: Account | null = null;
  feedbackEntries: FeedbackEntry[] = [];
  filteredFeedbackEntries: FeedbackEntry[] = [];
  isLoading = false;
  
  // Filter options
  selectedFilterType: string = 'all';
  selectedCompletionFilter: string = 'all';
  
  // Statistics
  feedbackStats = {
    total: 0,
    completed: 0,
    incomplete: 0,
    byType: {} as { [key: string]: number }
  };

  // Cache for template methods to prevent change detection loops
  private _cachedStatsEntries: Array<{key: string, value: number}> = [];

  // Available feedback types
  feedbackTypes = ['bug', 'feature', 'other'];
  
  // Current view
  currentView: 'overview' | 'feedback' = 'overview';

  constructor(
    private accountsService: AccountsService,
    private adminService: AdminService,
    private alertController: AlertController,
    private toastController: ToastController,
    private modalController: ModalController
  ) {}

  ngOnInit() {
    console.log('[AdminPage] Initializing admin page');
    
    // Subscribe to account changes
    this.accountsService.account$
      .pipe(takeUntil(this.destroy$))
      .subscribe(account => {
        this.account = account;
        console.log('[AdminPage] Account updated:', account);
      });

    // Subscribe to feedback entries
    this.adminService.feedbackEntries$
      .pipe(takeUntil(this.destroy$))
      .subscribe(entries => {
        this.feedbackEntries = entries;
        this.applyFilters();
        this.updateStats(); // Update stats whenever entries change
        console.log('[AdminPage] Feedback entries updated:', entries.length);
      });

    // Subscribe to loading state
    this.adminService.loading$
      .pipe(takeUntil(this.destroy$))
      .subscribe(loading => {
        this.isLoading = loading;
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // View management
  async onViewChange(event: any) {
    const newView = event.detail.value;
    console.log('[AdminPage] View changed to:', newView);
    
    if (newView === 'overview') {
      await this.switchToOverview();
    } else if (newView === 'feedback') {
      await this.switchToFeedback();
    }
  }

  async switchToOverview() {
    console.log('[AdminPage] Switching to overview');
    this.currentView = 'overview';
    // Load stats when switching to overview (if we have no data yet)
    if (this.feedbackStats.total === 0 && this.feedbackEntries.length === 0) {
      console.log('[AdminPage] Loading feedback stats...');
      await this.loadFeedbackStats();
    }
    console.log('[AdminPage] switchToOverview completed');
  }

  async switchToFeedback() {
    console.log('[AdminPage] Switching to feedback');
    this.currentView = 'feedback';
    if (this.feedbackEntries.length === 0) {
      await this.loadFeedback();
    }
  }

  // Data loading
  async loadFeedback() {
    try {
      await this.adminService.getAllFeedback();
      // Stats will be updated automatically when entries change
    } catch (error) {
      console.error('[AdminPage] Error loading feedback:', error);
      await this.showToast('Error loading feedback entries', 'danger');
    }
  }

  async loadFeedbackStats() {
    try {
      this.feedbackStats = await this.adminService.getFeedbackStats();
    } catch (error) {
      console.error('[AdminPage] Error loading feedback stats:', error);
    }
  }

  private updateStats() {
    console.log('[AdminPage] updateStats called');
    // Update stats from current entries without making additional API calls
    this.feedbackStats = this.adminService.getFeedbackStatsFromCurrent();
    // Update cached stats entries when stats change
    this._cachedStatsEntries = Object.entries(this.feedbackStats.byType).map(([key, value]) => ({key, value}));
    console.log('[AdminPage] Stats updated:', this.feedbackStats);
  }

  // Filtering
  onFilterTypeChange() {
    this.applyFilters();
  }

  onCompletionFilterChange() {
    this.applyFilters();
  }

  private applyFilters() {
    let filtered = [...this.feedbackEntries];

    // Filter by type
    if (this.selectedFilterType !== 'all') {
      filtered = filtered.filter(entry => entry.feedbackType === this.selectedFilterType);
    }

    // Filter by completion status
    if (this.selectedCompletionFilter === 'completed') {
      filtered = filtered.filter(entry => entry.isCompleted);
    } else if (this.selectedCompletionFilter === 'incomplete') {
      filtered = filtered.filter(entry => !entry.isCompleted);
    }

    this.filteredFeedbackEntries = filtered;
  }

  // Feedback actions
  async markAsComplete(feedbackEntry: FeedbackEntry) {
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
            } catch (error) {
              console.error('[AdminPage] Error marking feedback as complete:', error);
              await this.showToast('Error marking feedback as complete', 'danger');
            }
          }
        }
      ]
    });

    await alert.present();
  }

  async markAsIncomplete(feedbackEntry: FeedbackEntry) {
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
            } catch (error) {
              console.error('[AdminPage] Error marking feedback as incomplete:', error);
              await this.showToast('Error marking feedback as incomplete', 'danger');
            }
          }
        }
      ]
    });

    await alert.present();
  }

  async deleteFeedback(feedbackEntry: FeedbackEntry) {
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
               await this.adminService.deleteFeedback(feedbackEntry.id!);
               await this.showToast('Feedback deleted successfully', 'success');
            } catch (error) {
              console.error('[AdminPage] Error deleting feedback:', error);
              await this.showToast('Error deleting feedback', 'danger');
            }
          }
        }
      ]
    });

    await alert.present();
  }

  // Utility methods
  async showToast(message: string, color: 'success' | 'danger' | 'warning' | 'medium' = 'medium') {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      color: 'medium',
      position: 'top'
    });
    await toast.present();
  }

  getTypeColor(feedbackType: string): string {
    switch (feedbackType) {
      case 'bug': return 'danger';
      case 'feature': return 'primary';
      case 'other': return 'medium';
      default: return 'medium';
    }
  }

  getTypeIcon(feedbackType: string): string {
    switch (feedbackType) {
      case 'bug': return 'bug-outline';
      case 'feature': return 'bulb-outline';
      case 'other': return 'help-outline';
      default: return 'document-outline';
    }
  }

  formatDate(dateString: string | undefined): string {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Invalid Date';
    }
  }

  getStatsEntries(): Array<{key: string, value: number}> {
    console.log('[AdminPage] getStatsEntries called - this might be causing change detection loop!');
    // Return cached version to prevent change detection loops
    return this._cachedStatsEntries;
  }

  // Getter property for template - more efficient than method calls
  get statsEntries(): Array<{key: string, value: number}> {
    return this._cachedStatsEntries;
  }
} 
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, AlertController, ToastController, ModalController } from '@ionic/angular';
import { Subject, takeUntil } from 'rxjs';
import { AccountsService } from '../../services/accounts.service';
import { AdminService } from '../../services/admin.service';
import { Account, FeedbackEntry } from '../../services/nutrition-ambition-api.service';

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
  switchToOverview() {
    this.currentView = 'overview';
  }

  switchToFeedback() {
    this.currentView = 'feedback';
    if (this.feedbackEntries.length === 0) {
      this.loadFeedback();
    }
  }

  // Data loading
  async loadFeedback() {
    try {
      await this.adminService.getAllFeedback();
      await this.loadFeedbackStats();
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
              await this.loadFeedbackStats();
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
              await this.loadFeedbackStats();
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
              await this.loadFeedbackStats();
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
  async showToast(message: string, color: 'success' | 'danger' | 'warning' = 'success') {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      color,
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
    return Object.entries(this.feedbackStats.byType).map(([key, value]) => ({key, value}));
  }
} 
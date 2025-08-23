import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, AlertController, ModalController } from '@ionic/angular';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { AccountsService } from '../../../services/accounts.service';
import { AdminService } from '../../services/admin.service';
import { Account, FeedbackEntry, FeedbackWithAccount, ChatMessage } from '../../../services/nutrition-ambition-api.service';
import { ToastService } from '../../../services/toast.service';
import { DebugViewComponent } from '../../components/debug-view/debug-view.component';
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
  documentOutline,
  phonePortraitOutline,
  terminalOutline,
  radioButtonOnOutline,
  personOutline,
  closeOutline,
  arrowBackOutline,
  chevronUpOutline,
  chevronDownOutline
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
  'document-outline': documentOutline,
  'phone-portrait-outline': phonePortraitOutline,
  'terminal-outline': terminalOutline,
  'radio-button-on-outline': radioButtonOnOutline,
  'person-outline': personOutline,
  'close': closeOutline,
  'arrow-back-outline': arrowBackOutline,
  'chevron-up-outline': chevronUpOutline,
  'chevron-down-outline': chevronDownOutline
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
  feedbackEntries: FeedbackWithAccount[] = [];
  filteredFeedbackEntries: FeedbackWithAccount[] = [];
  isLoading = false;
  
  // Filter options
  selectedFilterType: string = 'all';
  selectedCompletionFilter: string = 'incomplete';
  userEmailFilter: string = '';
  selectedVersionFilter: string = 'all';
  
  // Sorting options
  sortColumn: 'date' | 'type' | 'status' | 'email' | null = 'date';
  sortDirection: 'asc' | 'desc' = 'desc'; // Default to newest first
  
  // Computed filter data
  uniqueAppVersions: string[] = [];
  
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
  currentView: 'overview' | 'feedback' | 'accounts' = 'feedback';

  // Accounts management
  accounts: Account[] = [];
  isLoadingAccounts = false;
  expandedAccountIds = new Set<string>();
  accountDataCounts: { [accountId: string]: any } = {};
  loadingAccountCounts = new Set<string>();
  lastDeletionAudit: any = null;

  constructor(
    private accountsService: AccountsService,
    private adminService: AdminService,
    private alertController: AlertController,
    private toastService: ToastService,
    private modalController: ModalController,
    private router: Router
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

    // Load initial data since we're starting with feedback view
    this.loadFeedback();
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
    } else if (newView === 'accounts') {
      await this.switchToAccounts();
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

  async switchToAccounts() {
    console.log('[AdminPage] Switching to accounts');
    this.currentView = 'accounts';
    if (this.accounts.length === 0) {
      await this.loadAccounts();
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

  async loadAccounts() {
    try {
      this.isLoadingAccounts = true;
      const response = await this.adminService.getAllAccounts();
      if (response.isSuccess && response.accounts) {
        this.accounts = response.accounts;
        console.log('[AdminPage] Loaded', this.accounts.length, 'accounts');
      } else {
        console.error('[AdminPage] Failed to load accounts:', response.errors);
        await this.showToast('Error loading accounts', 'danger');
      }
    } catch (error) {
      console.error('[AdminPage] Error loading accounts:', error);
      await this.showToast('Error loading accounts', 'danger');
    } finally {
      this.isLoadingAccounts = false;
    }
  }

  async deleteAccount(account: Account) {
    const alert = await this.alertController.create({
      header: 'Delete Account',
      message: `Are you sure you want to delete the account for "${account.email}"? This will permanently delete the account and all associated data including:
      
      • All feedback entries
      • All chat messages
      • All food entries
      • All daily targets
      • All user profiles
      
      This action cannot be undone.`,
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
              const response = await this.adminService.deleteAccount(account.id!, true);
              if (response.isSuccess) {
                // Store deletion audit for display
                this.lastDeletionAudit = {
                  accountEmail: account.email,
                  accountName: account.name,
                  totalRecordsDeleted: response.totalRecordsDeleted,
                  deletedRecordsByType: response.deletedRecordsByType,
                  deletedAt: new Date()
                };
                
                await this.showDeletionAudit();
                await this.loadAccounts(); // Refresh the list
              } else {
                console.error('[AdminPage] Failed to delete account:', response.errors);
                await this.showToast('Error deleting account', 'danger');
              }
            } catch (error) {
              console.error('[AdminPage] Error deleting account:', error);
              await this.showToast('Error deleting account', 'danger');
            }
          }
        }
      ]
    });

    await alert.present();
  }

  trackByAccountId(index: number, account: Account): string {
    return account.id!;
  }

  async toggleAccountExpansion(account: Account) {
    const accountId = account.id!;
    
    if (this.expandedAccountIds.has(accountId)) {
      // Collapse the row
      this.expandedAccountIds.delete(accountId);
    } else {
      // Expand the row and load data counts if not already loaded
      this.expandedAccountIds.add(accountId);
      
      if (!this.accountDataCounts[accountId] && !this.loadingAccountCounts.has(accountId)) {
        await this.loadAccountDataCounts(accountId);
      }
    }
  }

  async loadAccountDataCounts(accountId: string) {
    try {
      this.loadingAccountCounts.add(accountId);
      
      const response = await this.adminService.getAccountDataCounts(accountId);
      if (response.isSuccess) {
        this.accountDataCounts[accountId] = {
          totalCount: response.totalDataCount,
          dataCounts: response.dataCounts,
          breakdown: this.formatDataCountsBreakdown(response.dataCounts)
        };
        console.log('[AdminPage] Loaded data counts for account:', accountId, this.accountDataCounts[accountId]);
      } else {
        console.error('[AdminPage] Failed to load data counts:', response.errors);
        await this.showToast('Error loading account data counts', 'danger');
      }
    } catch (error) {
      console.error('[AdminPage] Error loading data counts:', error);
      await this.showToast('Error loading account data counts', 'danger');
    } finally {
      this.loadingAccountCounts.delete(accountId);
    }
  }

  formatDataCountsBreakdown(dataCounts: any): { label: string, count: number, icon: string }[] {
    const breakdown = [];
    
    if (dataCounts) {
      if (dataCounts.Feedback > 0) {
        breakdown.push({ label: 'Feedback Entries', count: dataCounts.Feedback, icon: 'chatbubbles-outline' });
      }
      if (dataCounts.ChatMessages > 0) {
        breakdown.push({ label: 'Chat Messages', count: dataCounts.ChatMessages, icon: 'chatbox-outline' });
      }
      if (dataCounts.DailyTargets > 0) {
        breakdown.push({ label: 'Daily Targets', count: dataCounts.DailyTargets, icon: 'target-outline' });
      }
      if (dataCounts.FoodEntries > 0) {
        breakdown.push({ label: 'Food Entries', count: dataCounts.FoodEntries, icon: 'restaurant-outline' });
      }
      if (dataCounts.UserProfiles > 0) {
        breakdown.push({ label: 'User Profiles', count: dataCounts.UserProfiles, icon: 'person-circle-outline' });
      }
    }
    
    return breakdown;
  }

  isAccountExpanded(account: Account): boolean {
    return this.expandedAccountIds.has(account.id!);
  }

  isLoadingCounts(account: Account): boolean {
    return this.loadingAccountCounts.has(account.id!);
  }

  getAccountCounts(account: Account): any {
    return this.accountDataCounts[account.id!];
  }

  async showDeletionAudit() {
    if (!this.lastDeletionAudit) return;

    const audit = this.lastDeletionAudit;
    
    // Create a clean, readable message
    let message = `Account "${audit.accountEmail}" has been successfully deleted.\n\n`;
    message += `Total Records Deleted: ${audit.totalRecordsDeleted}\n\n`;
    
    if (audit.deletedRecordsByType && audit.totalRecordsDeleted > 0) {
      message += `Breakdown by Type:\n`;
      Object.entries(audit.deletedRecordsByType).forEach(([type, count]: [string, any]) => {
        if (count > 0) {
          message += `• ${type}: ${count}\n`;
        }
      });
    } else if (audit.totalRecordsDeleted === 0) {
      message += `No user data was found for this account.`;
    }

    const alert = await this.alertController.create({
      header: 'Deletion Complete',
      message: message,
      buttons: [
        {
          text: 'OK',
          role: 'confirm',
          cssClass: 'alert-button-confirm'
        }
      ],
      cssClass: 'deletion-audit-alert'
    });

    await alert.present();
  }

  getDataTypeIcon(type: string): string {
    switch (type) {
      case 'Feedback': return '💬';
      case 'ChatMessages': return '💬';
      case 'DailyTargets': return '🎯';
      case 'FoodEntries': return '🍽️';
      case 'UserProfiles': return '👤';
      default: return '📄';
    }
  }

  private updateStats() {
    console.log('[AdminPage] updateStats called');
    // Update stats from current entries without making additional API calls
    this.feedbackStats = this.adminService.getFeedbackStatsFromCurrent();
    // Update cached stats entries when stats change
    this._cachedStatsEntries = Object.entries(this.feedbackStats.byType).map(([key, value]) => ({key, value}));
    
    // Note: App version filtering removed since appVersion is not available on FeedbackEntry
    this.uniqueAppVersions = [];
    
    console.log('[AdminPage] Stats updated:', this.feedbackStats);
    console.log('[AdminPage] Unique app versions:', this.uniqueAppVersions);
  }

  // Filtering
  onFilterTypeChange() {
    this.applyFilters();
  }

  onCompletionFilterChange() {
    this.applyFilters();
  }

  onUserEmailFilterChange() {
    this.applyFilters();
  }

  onVersionFilterChange() {
    this.applyFilters();
  }

  private applyFilters() {
    let filtered = [...this.feedbackEntries];

    // Filter by type
    if (this.selectedFilterType !== 'all') {
      filtered = filtered.filter(entry => entry.feedback?.feedbackType === this.selectedFilterType);
    }

    // Filter by completion status
    if (this.selectedCompletionFilter === 'completed') {
      filtered = filtered.filter(entry => entry.feedback?.isCompleted);
    } else if (this.selectedCompletionFilter === 'incomplete') {
      filtered = filtered.filter(entry => !entry.feedback?.isCompleted);
    }

    // Filter by user email
    if (this.userEmailFilter.trim()) {
      const emailFilter = this.userEmailFilter.toLowerCase().trim();
      filtered = filtered.filter(entry => 
        entry.accountEmail?.toLowerCase().includes(emailFilter)
      );
    }

    // Note: App version filtering removed since appVersion is not available on FeedbackEntry

    // Apply sorting
    filtered = this.applySorting(filtered);

    this.filteredFeedbackEntries = filtered;
  }

  private applySorting(entries: FeedbackWithAccount[]): FeedbackWithAccount[] {
    if (!this.sortColumn) return entries;

    return entries.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (this.sortColumn) {
        case 'date':
          aValue = new Date(a.feedback?.createdDateUtc || 0).getTime();
          bValue = new Date(b.feedback?.createdDateUtc || 0).getTime();
          break;
        case 'type':
          aValue = a.feedback?.feedbackType || '';
          bValue = b.feedback?.feedbackType || '';
          break;
        case 'status':
          aValue = a.feedback?.isCompleted ? 'completed' : 'pending';
          bValue = b.feedback?.isCompleted ? 'completed' : 'pending';
          break;
        case 'email':
          aValue = a.accountEmail || '';
          bValue = b.accountEmail || '';
          break;
        default:
          return 0;
      }

      // Handle string comparison
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const comparison = aValue.localeCompare(bValue);
        return this.sortDirection === 'asc' ? comparison : -comparison;
      }

      // Handle numeric comparison
      if (aValue < bValue) {
        return this.sortDirection === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return this.sortDirection === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }

  sortBy(column: 'date' | 'type' | 'status' | 'email') {
    if (this.sortColumn === column) {
      // Toggle direction if same column
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      // New column, default to ascending (except date which defaults to descending)
      this.sortColumn = column;
      this.sortDirection = column === 'date' ? 'desc' : 'asc';
    }
    
    this.applyFilters(); // Re-apply filters with new sorting
  }

    // Feedback actions
  async markAsComplete(feedbackWithAccount: FeedbackWithAccount) {
    const feedbackEntry = feedbackWithAccount.feedback;
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

  async markAsIncomplete(feedbackWithAccount: FeedbackWithAccount) {
    const feedbackEntry = feedbackWithAccount.feedback;
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

  async deleteFeedback(feedbackWithAccount: FeedbackWithAccount) {
    const feedbackEntry = feedbackWithAccount.feedback;
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
                // Reload feedback with current filters maintained
                await this.loadFeedback();
              } else {
                await this.showToast('Error deleting feedback', 'danger');
              }
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

  async viewUserContext(feedbackWithAccount: FeedbackWithAccount) {
    const feedbackEntry = feedbackWithAccount.feedback;
    if (!feedbackEntry || !feedbackWithAccount.accountId) return;

    try {
      console.log('[AdminPage] Opening debug view for account:', feedbackWithAccount.accountId);
      
      // Navigate to the debug page with the feedback data
      await this.router.navigate(['/debug', feedbackEntry.id, feedbackWithAccount.accountId], {
        state: { feedbackWithAccount }
      });
    } catch (error) {
      console.error('[AdminPage] Error opening debug view:', error);
      await this.showToast('Error opening debug view', 'danger');
    }
  }

  private async showDebugView(feedbackWithAccount: FeedbackWithAccount) {
    const modal = await this.modalController.create({
      component: DebugViewComponent,
      componentProps: {
        feedbackWithAccount: feedbackWithAccount
      },
      cssClass: 'debug-modal', // Full-screen debug view
      backdropDismiss: false, // Don't allow accidental dismissal
      showBackdrop: true
    });

    await modal.present();
  }

  // Utility methods
  async showToast(message: string, color: 'success' | 'danger' | 'warning' | 'medium' = 'medium') {
    await this.toastService.showToast({
      message,
      duration: 3000,
      color: 'medium'
    });
  }

  getTypeColor(feedbackType: string): string {
    switch (feedbackType) {
      case 'bug': return 'danger';
      case 'feature': return 'success';
      case 'other': return 'warning';
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

  // Helper method for table view
  getShortenedMessage(message: string | undefined): string {
    if (!message) return 'No message';
    const maxLength = 100;
    if (message.length <= maxLength) return message;
    return message.substring(0, maxLength) + '...';
  }
} 
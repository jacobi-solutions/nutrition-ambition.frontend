import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { IonicModule, NavController } from '@ionic/angular';
import { Subject, takeUntil } from 'rxjs';
import { 
  FeedbackWithAccount, 
  ChatMessage,
  Account 
} from '../../../services/nutrition-ambition-api.service';
import { AdminService } from '../../services/admin.service';
import { ChatService } from '../../../services/chat.service';
import { DateService } from '../../../services/date.service';
import { DebugViewComponent } from '../../components/debug-view/debug-view.component';
import { addIcons } from 'ionicons';
import { arrowBack, bugOutline } from 'ionicons/icons';

// Register icons
addIcons({
  'arrow-back': arrowBack,
  'bug-outline': bugOutline
});

@Component({
  selector: 'app-debug',
  templateUrl: './debug.page.html',
  styleUrls: ['./debug.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, DebugViewComponent],

})
export class DebugPage implements OnInit, OnDestroy {
  feedbackWithAccount?: FeedbackWithAccount;
  loading = true;
  
  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private navController: NavController,
    private adminService: AdminService
  ) {}

  ngOnInit() {
    this.loadFeedbackData();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private async loadFeedbackData() {
    try {
      this.loading = true;
      
      // Get feedback ID from route params
      const feedbackId = this.route.snapshot.params['feedbackId'];
      const accountId = this.route.snapshot.params['accountId'];
      
      if (feedbackId && accountId) {
        // Load the specific feedback with account info
        const response = await this.adminService.getAllFeedback({
          // We'll need to filter by the specific feedback entry
        });
        
        if (response.isSuccess && response.feedbackWithAccounts) {
          this.feedbackWithAccount = response.feedbackWithAccounts.find(
            f => f.feedback?.id === feedbackId && f.accountId === accountId
          );
        }
      }
      
      // If we couldn't load from API, try to get from navigation state
      if (!this.feedbackWithAccount) {
        const navigation = this.router.getCurrentNavigation();
        if (navigation?.extras?.state?.['feedbackWithAccount']) {
          this.feedbackWithAccount = navigation.extras.state['feedbackWithAccount'];
        }
      }
      
    } catch (error) {
      console.error('[DebugPage] Error loading feedback data:', error);
    } finally {
      this.loading = false;
    }
  }

  goBack() {
    this.navController.back();
  }
}

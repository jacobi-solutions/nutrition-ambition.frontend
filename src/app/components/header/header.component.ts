import { Component, OnInit, OnDestroy, Input, Output, EventEmitter, inject, ChangeDetectorRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { 
  IonHeader, 
  IonToolbar, 
  IonButtons, 
  IonBackButton, 
  IonButton, 
  IonIcon, 
  IonTitle, 
  IonDatetimeButton,
  IonModal,
  IonDatetime,
  IonChip,
  IonLabel,
  IonText,
  IonRow,
  IonCol,
  IonGrid,

  IonPopover,
  PopoverController
} from '@ionic/angular/standalone';
import { AuthService } from 'src/app/services/auth.service';
import { Router, RouterModule } from '@angular/router';
import { addIcons } from 'ionicons';
import { 
  chevronBackOutline, 
  logOutOutline, 
  personCircle, 
  logInOutline,
  chevronForwardOutline,
  settingsOutline,
  informationCircleOutline,
  keyOutline
} from 'ionicons/icons';
import { DateService } from 'src/app/services/date.service';
import { AnalyticsService } from 'src/app/services/analytics.service';
import { Subscription } from 'rxjs';
import { format } from 'date-fns';
import { SettingsPopoverComponent } from '../settings-popover/settings-popover.component';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
  standalone: true,
  imports: [
    CommonModule, 
    RouterModule,
    IonHeader, 
    IonToolbar, 
    IonButtons, 
    IonBackButton, 
    IonButton, 
    IonIcon, 
    IonTitle, 
    IonDatetimeButton,
    IonModal,
    IonDatetime,

      IonPopover,
    SettingsPopoverComponent
  ]
})
export class AppHeaderComponent implements OnInit, OnDestroy {
  @Input() showBackButton: boolean = false;
  
  @Input() title: string = 'Nutrition Ambition';
  userEmail: string | null = null;
  
  // We'll use both input and service to ensure synchronization
  @Input() set selectedDate(value: string) {
    if (value) {
      this._selectedDate = value;
    }
  }
  
  get selectedDate(): string {
    return this._selectedDate;
  }
  
  // Local date only — uses 'yyyy-MM-dd' format
  // UTC conversion handled via dateService when communicating with backend
  private _selectedDate: string = format(new Date(), 'yyyy-MM-dd');

  @Output() previousDay = new EventEmitter<void>();
  @Output() nextDay = new EventEmitter<void>();
  @Output() dateChanged = new EventEmitter<string>();
  @Output() logout = new EventEmitter<void>();
  @Output() login = new EventEmitter<void>();
  @Output() refresh = new EventEmitter<void>();

  // Computed properties for "return to today" button
  isViewingHistoricalDate: boolean = false;
  todayDayNumber: string = '';
  
  private lastDateChange = 0;
  private dateSubscription: Subscription;
  private dateService = inject(DateService);
  private authSubscriptions: Subscription[] = [];

  // Auth-derived UI state
  isLoggedIn: boolean = false;
  isAnonymousUser: boolean = false;
  displayName: string | null = null;
  
  // Unique ID for popover trigger to avoid conflicts between page instances
  triggerId: string = `settings-trigger-${Math.random().toString(36).substr(2, 9)}`;

  @ViewChild('settingsPopover') settingsPopover!: IonPopover;

  constructor(
    private authService: AuthService,
    private router: Router,
    private cdRef: ChangeDetectorRef,
    private analyticsService: AnalyticsService
  ) {
    // Add the icons explicitly to the library
    addIcons({
      chevronBackOutline,
      logOutOutline,
      personCircle,
      logInOutline,
      chevronForwardOutline,
      settingsOutline,
      informationCircleOutline,
      keyOutline
    });
  }

  ngOnInit() {
    // Subscribe to auth state so the header reflects changes immediately
    const subUid = this.authService.userUid$.subscribe(uid => {
      this.isLoggedIn = !!uid;
      this.updateDisplayName();
    });
    const subEmail = this.authService.userEmail$.subscribe(email => {
      this.userEmail = email;
      this.updateDisplayName();
    });
    this.authSubscriptions.push(subUid, subEmail);

    // Initialize today's day number
    this.updateTodayDayNumber();

    // Subscribe to date changes from the service
    this.dateSubscription = this.dateService.selectedDate$.subscribe(date => {
      this._selectedDate = date;
      this.updateHistoricalDateStatus();

      // Force change detection to update the view
      this.cdRef.detectChanges();
    });
  }
  
  ngOnDestroy() {
    // Clean up subscription
    if (this.dateSubscription) {
      this.dateSubscription.unsubscribe();
    }
    this.authSubscriptions.forEach(s => s.unsubscribe());
  }
  
  // Handle date change from the datetime picker
  onDateChanged(event: CustomEvent) {
    const now = Date.now();
    // If less than 300ms since last change, ignore
    if (now - this.lastDateChange < 300) {
      return;
    }
    
    this.lastDateChange = now;

    // Extract the new date value and emit it
    if (event.detail && event.detail.value) {
      const newDate = event.detail.value;

      // Track date change analytics
      this.analyticsService.trackActionClick('date_changed', 'header', {
        newDate: newDate,
        source: 'date_picker'
      });
      
      // Use dateService to set the selected date (handles local format conversion)
      this.dateService.setSelectedDate(newDate);
    }
  }

  // Handle auth actions
  onLogout() {
    // Track logout analytics
    this.analyticsService.trackAuthEvent('logout');
    this.logout.emit();
  }
  
  onLogin() {
    this.login.emit();
  }

  private updateDisplayName() {
    // Query anonymity from service and derive a compact display name
    this.isAnonymousUser = this.authService.isAnonymous();
    if (!this.isLoggedIn) {
      this.displayName = null;
    } else if (this.isAnonymousUser) {
      this.displayName = 'Guest';
    } else if (this.userEmail) {
      const localPart = this.userEmail.split('@')[0];
      this.displayName = localPart || 'User';
    } else {
      this.displayName = 'User';
    }
    // Ensure the view updates even if this fires outside Angular zone
    try { this.cdRef.detectChanges(); } catch {}
  }
  
  // Navigate to previous day
  onPreviousDay() {
    this.previousDay.emit();
  }
  
  // Navigate to next day
  onNextDay() {
    this.nextDay.emit();
  }

  // Return to today
  onReturnToToday() {
    this.analyticsService.trackActionClick('return_to_today', 'header');
    this.dateService.setSelectedDate(this.dateService.getTodayDate());
  }

  // Update whether we're viewing a historical date (2+ days in the past)
  private updateHistoricalDateStatus() {
    const today = new Date(this.dateService.getTodayDate());
    const selectedDate = new Date(this._selectedDate);

    // Calculate the difference in days
    const diffTime = today.getTime() - selectedDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    // Show button only if 2+ days in the past
    this.isViewingHistoricalDate = diffDays >= 2;
  }

  // Update today's day number for the button
  private updateTodayDayNumber() {
    const today = new Date();
    this.todayDayNumber = today.getDate().toString();
  }

  // Settings dropdown methods
  async onSettingsAction(actionData: { action: string, event?: Event }) {
    const { action, event } = actionData;
    
    // Handle the action
    switch (action) {
      case 'signout':
        this.onLogout();
        break;
    }
  }
} 
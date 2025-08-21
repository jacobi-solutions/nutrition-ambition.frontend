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
  downloadOutline,
  informationCircleOutline,
  keyOutline
} from 'ionicons/icons';
import { DateService } from 'src/app/services/date.service';
import { Subscription } from 'rxjs';
import { format } from 'date-fns';
import { PwaInstallService } from 'src/app/services/pwa-install.service';
import { PwaInstallComponent } from '../pwa-install/pwa-install.component';
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
      console.log(`[AppHeader] Input date changed to: ${value}`);
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

  canInstall: boolean = false;
  @ViewChild('settingsPopover') settingsPopover!: IonPopover;

  constructor(
    private authService: AuthService, 
    private router: Router,
    private cdRef: ChangeDetectorRef,
    private pwa: PwaInstallService,
    private popoverCtrl: PopoverController
  ) {
    // Add the icons explicitly to the library
    addIcons({ 
      chevronBackOutline, 
      logOutOutline, 
      personCircle, 
      logInOutline, 
      chevronForwardOutline,
      settingsOutline,
      downloadOutline,
      informationCircleOutline,
      keyOutline
    });

    this.canInstall = this.pwa.canInstall();
  }

  ngOnInit() {
    // Log initial state
    console.log(`[AppHeader] Init with date: ${this._selectedDate}`);
    console.log(`[AppHeader] Service date: ${this.dateService.getSelectedDate()}`);
    
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
    
    // Subscribe to date changes from the service
    this.dateSubscription = this.dateService.selectedDate$.subscribe(date => {
      console.log(`[AppHeader] Date from service changed to: ${date}`);
      this._selectedDate = date;
      
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
    console.log('[AppHeader] Component destroyed');
  }
  
  // Handle date change from the datetime picker
  onDateChanged(event: CustomEvent) {
    const now = Date.now();
    // If less than 300ms since last change, ignore
    if (now - this.lastDateChange < 300) {
      console.log('[AppHeader] Ignoring rapid date change');
      return;
    }
    
    this.lastDateChange = now;
    console.log('[AppHeader] User selected date from picker:', event);
    
    // Extract the new date value and emit it
    if (event.detail && event.detail.value) {
      const newDate = event.detail.value;
      console.log(`[AppHeader] Emitting new date: ${newDate}`);
      
      // Use dateService to set the selected date (handles local format conversion)
      this.dateService.setSelectedDate(newDate);
    }
  }

  // Handle auth actions
  onLogout() {
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
    console.log('[AppHeader] Previous day clicked');
    this.previousDay.emit();
  }
  
  // Navigate to next day
  onNextDay() {
    console.log('[AppHeader] Next day clicked');
    this.nextDay.emit();
  }
  

  
  // Settings dropdown methods
  async onSettingsAction(actionData: { action: string, event?: Event }) {
    const { action, event } = actionData;
    
    // Handle the action
    switch (action) {
      case 'signout':
        this.onLogout();
        break;
      case 'download':
        await this.installPwa(event);
        break;
    }
  }

  async installPwa(event?: Event) {
    const result = await this.pwa.install();

    // Android/Chrome prompt path (no message → handled natively)
    if (result?.outcome) {
      // Analytics are now tracked in PwaInstallService
      return;
    }

    // Everyone else → show instructions popover
    if (result?.message) {
      const popover = await this.popoverCtrl.create({
        component: PwaInstallComponent,
        componentProps: { message: result.message },
        event: event,
        translucent: true,
      });
      await popover.present();
    }
  }
} 
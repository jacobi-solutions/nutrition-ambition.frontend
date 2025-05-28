import { Component, OnInit, OnDestroy, Input, Output, EventEmitter, inject, ChangeDetectorRef } from '@angular/core';
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
  IonGrid
} from '@ionic/angular/standalone';
import { AuthService } from 'src/app/services/auth.service';
import { Router, RouterModule } from '@angular/router';
import { addIcons } from 'ionicons';
import { 
  chevronBackOutline, 
  logOutOutline, 
  personCircle, 
  logInOutline, 
  chevronForwardOutline 
} from 'ionicons/icons';
import { DateService } from 'src/app/services/date.service';
import { Subscription } from 'rxjs';

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
    IonDatetime
  ]
})
export class AppHeaderComponent implements OnInit, OnDestroy {
  @Input() showBackButton: boolean = false;
  @Input() userEmail: string | null = null;
  @Input() title: string = 'Nutrition Ambition';
  
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
  
  private _selectedDate: string = new Date().toISOString();
  
  @Output() previousDay = new EventEmitter<void>();
  @Output() nextDay = new EventEmitter<void>();
  @Output() dateChanged = new EventEmitter<string>();
  @Output() logout = new EventEmitter<void>();
  @Output() login = new EventEmitter<void>();
  
  private lastDateChange = 0;
  private dateSubscription: Subscription;
  private dateService = inject(DateService);

  constructor(
    private authService: AuthService, 
    private router: Router,
    private cdRef: ChangeDetectorRef
  ) {
    // Add the icons explicitly to the library
    addIcons({ 
      chevronBackOutline, 
      logOutOutline, 
      personCircle, 
      logInOutline, 
      chevronForwardOutline 
    });
  }

  ngOnInit() {
    // Log initial state
    console.log(`[AppHeader] Init with date: ${this._selectedDate}`);
    console.log(`[AppHeader] Service date: ${this.dateService.getSelectedDate()}`);
    
    // Only get the email from AuthService if not provided as input
    if (!this.userEmail) {
      this.authService.userEmail$.subscribe(email => {
        this.userEmail = email;
      });
    }
    
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
      
      // Update the internal state and emit to parent
      this._selectedDate = newDate;
      this.dateChanged.emit(newDate);
    }
  }

  // Handle auth actions
  onLogout() {
    this.logout.emit();
  }
  
  onLogin() {
    this.login.emit();
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
} 
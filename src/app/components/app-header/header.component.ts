import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
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
    IonChip,
    IonLabel,
    IonText,
    IonRow,
    IonCol,
    IonGrid
  ]
})
export class AppHeaderComponent implements OnInit {
  @Input() selectedDate: string;
  @Input() showBackButton: boolean = false;
  @Input() userEmail: string | null = null;
  @Input() title: string = 'Nutrition Ambition';
  
  @Output() previousDay = new EventEmitter<void>();
  @Output() nextDay = new EventEmitter<void>();
  @Output() dateChanged = new EventEmitter<string>();
  @Output() logout = new EventEmitter<void>();
  @Output() login = new EventEmitter<void>();
  
  private lastDateChange = 0;

  constructor(private authService: AuthService, private router: Router) {
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
    // Only get the email from AuthService if not provided as input
    if (!this.userEmail) {
      this.authService.userEmail$.subscribe(email => {
        this.userEmail = email;
      });
    }
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
    console.log('[AppHeader] Date changed:', event);
    
    // Extract the new date value and emit it
    if (event.detail && event.detail.value) {
      this.dateChanged.emit(event.detail.value);
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
    this.previousDay.emit();
  }
  
  // Navigate to next day
  onNextDay() {
    this.nextDay.emit();
  }
} 
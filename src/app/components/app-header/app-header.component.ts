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
  IonLabel
} from '@ionic/angular/standalone';
import { AuthService } from 'src/app/services/auth.service';
import { Router, RouterModule } from '@angular/router';
import { addIcons } from 'ionicons';
import { chevronBackOutline, logOutOutline, personCircle } from 'ionicons/icons';

@Component({
  selector: 'app-header',
  templateUrl: './app-header.component.html',
  styleUrls: ['./app-header.component.scss'],
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
    IonLabel
  ]
})
export class AppHeaderComponent implements OnInit {
  userEmail: string | null = null;
  @Input() selectedDate: string;
  @Input() title: string = 'Nutrition Ambition';
  @Input() showBackButton: boolean = false;
  @Output() previousDay = new EventEmitter<void>();
  @Output() dateChanged = new EventEmitter<CustomEvent>();
  private lastDateChange = 0;

  constructor(private authService: AuthService, private router: Router) {
    // Add the icons explicitly to the library
    addIcons({ chevronBackOutline, logOutOutline, personCircle });
  }

  ngOnInit() {
    this.authService.userEmail$.subscribe(email => {
      this.userEmail = email;
    });
  }
  
  // Debounce date changes to prevent multiple rapid emissions
  onDateChanged(event: CustomEvent) {
    const now = Date.now();
    // If less than 300ms since last change, ignore
    if (now - this.lastDateChange < 300) {
      console.log('[AppHeader] Ignoring rapid date change');
      return;
    }
    
    this.lastDateChange = now;
    console.log('[AppHeader] Date changed:', event);
    this.dateChanged.emit(event);
  }

  async logout() {
    await this.authService.signOutUser();
    this.router.navigate(['/login']);
  }
} 
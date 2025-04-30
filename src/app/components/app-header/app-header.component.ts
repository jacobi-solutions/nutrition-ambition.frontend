import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { AuthService } from 'src/app/services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-header',
  templateUrl: './app-header.component.html',
  styleUrls: ['./app-header.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule]
})
export class AppHeaderComponent implements OnInit {
  userEmail: string | null = null;
  @Input() selectedDate: string;
  @Input() title: string = 'Nutrition Ambition';
  @Input() showBackButton: boolean = false;
  @Output() previousDay = new EventEmitter<void>();
  @Output() dateChanged = new EventEmitter<CustomEvent>();

  constructor(private authService: AuthService, private router: Router) {}

  ngOnInit() {
    this.authService.userEmail$.subscribe(email => {
      this.userEmail = email;
    });
  }

  async logout() {
    await this.authService.signOutUser();
    this.router.navigate(['/login']);
  }
} 
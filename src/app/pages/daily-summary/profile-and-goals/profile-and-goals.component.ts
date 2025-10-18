import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonButton,
  IonSpinner,
  IonIcon
} from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { catchError, finalize, of } from 'rxjs';
import { addIcons } from 'ionicons';
import { person, trophy } from 'ionicons/icons';
import {
  NutritionAmbitionApiService,
  GetProfileAndTargetsRequest,
  GetProfileAndTargetsResponse
} from '../../../services/nutrition-ambition-api.service';
import { ChatService } from '../../../services/chat.service';
import { DateService } from '../../../services/date.service';
import { ToastService } from '../../../services/toast.service';

@Component({
  selector: 'app-profile-and-goals',
  templateUrl: './profile-and-goals.component.html',
  styleUrls: ['./profile-and-goals.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonButton,
    IonSpinner,
    IonIcon
  ]
})
export class ProfileAndGoalsComponent implements OnInit {
  private apiService = inject(NutritionAmbitionApiService);
  private chatService = inject(ChatService);
  private dateService = inject(DateService);
  private router = inject(Router);
  private toastService = inject(ToastService);

  viewMode: 'goals' | 'profile' = 'goals';
  userProfile: GetProfileAndTargetsResponse | null = null;
  hasGoals = false;
  hasProfile = false;
  goalsDisplay = '';
  isLoadingProfile = false;

  constructor() {
    addIcons({
      person,
      trophy
    });
  }

  ngOnInit() {
    this.loadUserProfile();
  }

  toggleView() {
    this.viewMode = this.viewMode === 'goals' ? 'profile' : 'goals';
  }

  loadUserProfile(): void {
    this.isLoadingProfile = true;

    const request = new GetProfileAndTargetsRequest({
      localDateKey: this.dateService.getSelectedDate()
    });

    this.apiService.getProfileAndTargets(request)
      .pipe(
        catchError(error => {
          console.error('Error loading profile:', error);
          return of(null);
        }),
        finalize(() => {
          this.isLoadingProfile = false;
        })
      )
      .subscribe(response => {
        if (response && response.isSuccess) {
          this.userProfile = response;

          // Check if user has goals
          this.hasGoals = !!(
            (response.goals && response.goals.length > 0) ||
            (response.goalSummary && response.goalSummary.trim().length > 0)
          );

          // Check if user has profile information (exclude baseCalories since it's now a default)
          this.hasProfile = !!(
            response.age ||
            response.sex ||
            response.heightFeet ||
            response.heightInches ||
            response.weightLbs ||
            response.activityLevel
          );

          // Format goals display
          if (this.hasGoals) {
            if (response.goalSummary && response.goalSummary.trim().length > 0) {
              // Use AI-generated goal summary if available
              this.goalsDisplay = response.goalSummary;
            } else if (response.goals && response.goals.length > 0) {
              // Format goals array as bullet points
              this.goalsDisplay = response.goals.map(goal => `• ${goal}`).join('\n');
            }
          }
        }
      });
  }

  onSetupGoals(): void {
    this.chatService.setContextNote('Setting up your nutrition goals');
    this.router.navigate(['/app/chat']);

    this.chatService.setupGoals(this.dateService.getTodayDate(), false).subscribe({
      next: (response) => {
        if (!response.isSuccess) {
          this.showErrorToast('Failed to start goal setup. Please try again.');
        }
      },
      error: (error) => {
        this.showErrorToast('An error occurred while starting goal setup.');
      }
    });
  }

  onTweakGoals(): void {
    this.chatService.setContextNote('Tweaking your nutrition goals');
    this.router.navigate(['/app/chat']);

    this.chatService.setupGoals(this.dateService.getTodayDate(), true).subscribe({
      next: (response) => {
        if (!response.isSuccess) {
          this.showErrorToast('Failed to start goal tweaking. Please try again.');
        }
      },
      error: (error) => {
        this.showErrorToast('An error occurred while starting goal tweaking.');
      }
    });
  }

  onSetupProfile(): void {
    // Setting up profile initiates the same goal setup flow
    this.chatService.setContextNote('Setting up your profile and nutrition goals');
    this.router.navigate(['/app/chat']);

    this.chatService.setupGoals(this.dateService.getTodayDate(), false).subscribe({
      next: (response) => {
        if (!response.isSuccess) {
          this.showErrorToast('Failed to start profile setup. Please try again.');
        }
      },
      error: (error) => {
        this.showErrorToast('An error occurred while starting profile setup.');
      }
    });
  }

  onUpdateProfile(): void {
    // Updating profile initiates the same goal setup flow (in tweak mode)
    this.chatService.setContextNote('Updating your profile and nutrition goals');
    this.router.navigate(['/app/chat']);

    this.chatService.setupGoals(this.dateService.getTodayDate(), true).subscribe({
      next: (response) => {
        if (!response.isSuccess) {
          this.showErrorToast('Failed to start profile update. Please try again.');
        }
      },
      error: (error) => {
        this.showErrorToast('An error occurred while starting profile update.');
      }
    });
  }

  private async showErrorToast(message: string) {
    await this.toastService.showToast({
      message,
      duration: 1500,
      color: 'medium'
    });
  }
}

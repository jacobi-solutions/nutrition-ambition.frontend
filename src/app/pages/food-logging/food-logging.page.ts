import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, IonContent, ModalController } from '@ionic/angular'; // Import ModalController
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { NutritionAmbitionApiService, ParseFoodTextRequest, NutritionApiResponse } from 'src/app/services/nutrition-ambition-api.service';

// Import new components
import { ChatMessage, ChatMessageComponent } from './chat-message/chat-message.component';
import { ChatInputComponent } from './chat-input/chat-input.component';
import { NutritionVisualizationComponent } from './nutrition-visualization/nutrition-visualization.component';

@Component({
  selector: 'app-food-logging',
  templateUrl: './food-logging.page.html',
  styleUrls: ['./food-logging.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonicModule,
    ChatMessageComponent, // Add ChatMessageComponent
    ChatInputComponent,   // Add ChatInputComponent
    NutritionVisualizationComponent // Keep for modal
  ]
})
export class FoodLoggingPage implements OnInit, OnDestroy {
  @ViewChild(IonContent) content!: IonContent; // To scroll to bottom

  messages: ChatMessage[] = [];
  isLoading: boolean = false;
  errorMessage: string = '';
  userEmail: string | null = null;
  private userEmailSubscription: Subscription;

  // Modal related properties
  isModalOpen = false;
  selectedNutritionData: any = null;

  constructor(
    private authService: AuthService,
    private router: Router,
    private nutritionApiService: NutritionAmbitionApiService,
    private modalController: ModalController // Inject ModalController
  ) {
    this.userEmailSubscription = this.authService.userEmail$.subscribe(email => {
      this.userEmail = email;
    });
  }

  ngOnInit() {
    // Add initial greeting message from AI
    this.messages.push({
      sender: 'ai',
      text: 'Hello! What did you eat today?',
      timestamp: new Date()
    });
  }

  ngOnDestroy() {
    if (this.userEmailSubscription) {
      this.userEmailSubscription.unsubscribe();
    }
  }

  handleNewMessage(text: string) {
    // Add user message to chat
    const userMessage: ChatMessage = {
      sender: 'user',
      text: text,
      timestamp: new Date()
    };
    this.messages.push(userMessage);
    this.scrollToBottom();

    // Prepare for AI response
    this.isLoading = true;
    this.errorMessage = '';

    const request = new ParseFoodTextRequest({ foodDescription: text });

    // Call the API
    this.nutritionApiService.processFoodTextAndGetNutrition(request)
      .pipe(
        finalize(() => {
          this.isLoading = false;
          this.scrollToBottom();
        })
      )
      .subscribe({
        next: (response: NutritionApiResponse) => {
          if (response && response.isSuccess) {
            // Add AI response to chat
            const aiMessage: ChatMessage = {
              sender: 'ai',
              text: response.aiCoachResponse || 'Logged!', // Use AI coach response
              timestamp: new Date(),
              nutritionData: response.foods && response.foods.length > 0 ? response : null // Store full response if foods exist
            };
            this.messages.push(aiMessage);
          } else {
            // Add error message as AI response
            const errorText = response?.errors?.join(' ') || 'Sorry, I couldn\'t process that.';
            this.messages.push({
              sender: 'ai',
              text: errorText,
              timestamp: new Date()
            });
            this.errorMessage = errorText; // Optionally show error elsewhere too
          }
        },
        error: (error) => {
          console.error('Error processing food text:', error);
          const errorText = 'Sorry, an error occurred while contacting the server.';
          this.messages.push({
            sender: 'ai',
            text: errorText,
            timestamp: new Date()
          });
          this.errorMessage = errorText;
        }
      });
  }

  // Method to open the nutrition details modal
  async showNutritionDetails(nutritionData: any) {
    this.selectedNutritionData = nutritionData;
    this.isModalOpen = true;
    // Note: Modal presentation is handled in the template using *ngIf="isModalOpen"
  }

  // Method to close the modal (called from the modal itself or template)
  closeNutritionModal() {
    this.isModalOpen = false;
    this.selectedNutritionData = null;
  }

  scrollToBottom() {
    // Use setTimeout to allow the DOM to update before scrolling
    setTimeout(() => {
      this.content?.scrollToBottom(300);
    }, 100);
  }

  async signOut() {
    try {
      await this.authService.signOutUser();
      this.router.navigate(['/login']); // Redirect to login page
    } catch (error) {
      console.error('Error signing out:', error);
    }
  }
}


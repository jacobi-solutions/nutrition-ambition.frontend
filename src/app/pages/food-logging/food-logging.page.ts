import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, IonContent } from '@ionic/angular';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { finalize } from 'rxjs/operators';

// Import FoodLoggingService instead of direct API service
import { FoodLoggingService } from 'src/app/services/food-logging.service';

// Import new components
import { ChatMessage, ChatMessageComponent } from './chat-message/chat-message.component';
import { ChatInputComponent } from './chat-input/chat-input.component';
import { NutritionVisualizationComponent } from './nutrition-visualization/nutrition-visualization.component';
import { FloatingActionButtonComponent } from '../../components/floating-action-button/floating-action-button.component';

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
    FloatingActionButtonComponent // Add Floating Action Button
  ]
})
export class FoodLoggingPage implements OnInit, OnDestroy {
  @ViewChild(IonContent) content!: IonContent; // To scroll to bottom

  messages: ChatMessage[] = [];
  isLoading: boolean = false;
  errorMessage: string = '';
  userEmail: string | null = null;
  private userEmailSubscription: Subscription;

  constructor(
    private authService: AuthService,
    private router: Router,
    private foodLoggingService: FoodLoggingService
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
    const userMessage: ChatMessage = {
      sender: 'user',
      text,
      timestamp: new Date()
    };
    this.messages.push(userMessage);
    this.scrollToBottom();

    this.isLoading = true;
    this.errorMessage = '';

    this.foodLoggingService.processUserInput(text)
      .pipe(finalize(() => {
        this.isLoading = false;
        this.scrollToBottom();
      }))
      .subscribe({
        next: (response) => {
          const aiMessage: ChatMessage = {
            sender: 'ai',
            text: response.aiCoachResponse || 'Logged!',
            timestamp: new Date(),
            nutritionData: response.foods && response.foods.length > 0 ? response : null
          };
          this.messages.push(aiMessage);
        },
        error: (err) => {
          const errorText = err?.message || 'Sorry, an error occurred while contacting the server.';
          this.messages.push({
            sender: 'ai',
            text: errorText,
            timestamp: new Date()
          });
          this.errorMessage = errorText;
        }
      });
  }

  // Updated to navigate to food-detail page
  showNutritionDetails(nutritionData: any) {
    this.router.navigate(['/food-detail'], {
      state: { nutritionData }
    });
  }

  // Floating Action Button handlers
  handleTakePhoto() {
    console.log('Take Photo tapped');
  }

  handleScanBarcode() {
    console.log('Scan Barcode tapped');
  }

  handleQuickAdd() {
    console.log('Quick Add tapped');
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


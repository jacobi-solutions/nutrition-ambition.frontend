import { Injectable } from '@angular/core';
import { NutritionAmbitionApiService } from './nutrition-ambition-api.service';

@Injectable({
  providedIn: 'root',
})
export class UserEngagementService {
    constructor(private apiService: NutritionAmbitionApiService) {
        
    }
  saveUserEngagement(email: string): void {
    // Placeholder for backend integration
    console.log(`User engagement saved for email: ${email}`);
  }
} 
import { enableProdMode, ErrorHandler, Injectable } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
import { RouteReuseStrategy } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular/standalone';

// Firebase and AngularFire imports
import { initializeApp, provideFirebaseApp, getApp } from '@angular/fire/app';
import { provideAuth, initializeAuth } from '@angular/fire/auth';
import { indexedDBLocalPersistence, browserPopupRedirectResolver, browserLocalPersistence } from 'firebase/auth';

import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApiInterceptor } from './app/http-interceptors/api.interceptor';

import { NutritionAmbitionApiService, API_BASE_URL } from './app/services/nutrition-ambition-api.service';
import { environment } from './environments/environment';

import { addIcons } from 'ionicons';
import { 
  logOutOutline, 
  addOutline, 
  cameraOutline, 
  barcodeOutline, 
  addCircleOutline, 
  sendOutline, 
  send,
  paperPlaneSharp,
  chevronBackOutline,
  chevronBackCircleOutline,
  chevronUpOutline,
  chevronDownOutline,
  chevronForwardOutline,
  chevronForwardCircleOutline,
  personCircle
} from 'ionicons/icons';

addIcons({
  'log-out-outline': logOutOutline,
  'add-outline': addOutline,
  'camera-outline': cameraOutline,
  'barcode-outline': barcodeOutline,
  'add-circle-outline': addCircleOutline,
  'send-outline': sendOutline,
  'send': send,
  'paper-plane-sharp': paperPlaneSharp,
  'chevron-back-outline': chevronBackOutline,
  'chevron-forward-outline': chevronForwardOutline,
  'chevron-down-outline': chevronDownOutline,
  'chevron-up-outline': chevronUpOutline,
  'chevron-back-circle-outline': chevronBackCircleOutline,
  'chevron-forward-circle-outline': chevronForwardCircleOutline,
  'person-circle': personCircle
  
});

// Provide the API base URL
export function getAPIBaseUrl(): string {
  return environment.backendApiUrl;
}

// Custom Error Handler to gracefully handle unexpected errors
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  handleError(error: any): void {
    // Log the error
    console.error('Global error handler caught:', error);
    
    // Check if it's a network-related error
    if (error?.status === 0 || error?.name === 'HttpErrorResponse') {
      console.warn('Network error detected in global handler');
      
      // Clear any loading indicators that might be stuck
      const loadingSpinners = document.querySelectorAll('.loading-indicator');
      loadingSpinners.forEach(spinner => {
        spinner.classList.add('hidden');
      });
      
      // You could also show a global connection error toast/alert here
    }
  }
}

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    provideIonicAngular(),
    provideRouter(routes, withPreloading(PreloadAllModules)),

    // Initialize Firebase App
    provideFirebaseApp(() => initializeApp(environment.firebase)),

    // Initialize Firebase Auth with durable persistence
    provideAuth(() => {
      const app = getApp(); // Get Firebase app instance
      // Force durable, multi-tab persistence to prevent session-only logouts across reloads
      // and mitigate iOS Safari/WebKit storage quirks. Also attach popup/redirect handling.
      return initializeAuth(app, {
        persistence: [indexedDBLocalPersistence, browserLocalPersistence],
        popupRedirectResolver: browserPopupRedirectResolver,
      });
    }),

    // Provide HttpClient with ApiInterceptor
    provideHttpClient(withInterceptors([
      ApiInterceptor
    ])),

    // Provide NSwag API Service
    NutritionAmbitionApiService,

    // Provide API_BASE_URL using factory function
    { provide: API_BASE_URL, useFactory: getAPIBaseUrl },
  ],
}).catch(err => console.error(err));

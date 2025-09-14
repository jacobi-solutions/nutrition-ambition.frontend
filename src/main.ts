import { enableProdMode, ErrorHandler, Injectable, isDevMode } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
import { RouteReuseStrategy } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular/standalone'; 

// Firebase and AngularFire imports
import { initializeApp, provideFirebaseApp, getApp } from '@angular/fire/app';
import { provideAuth, initializeAuth } from '@angular/fire/auth';
import { indexedDBLocalPersistence, browserPopupRedirectResolver, browserLocalPersistence } from 'firebase/auth';
import { provideAnalytics, getAnalytics, ScreenTrackingService, UserTrackingService } from '@angular/fire/analytics';

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
import { provideServiceWorker } from '@angular/service-worker';

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
    if (error?.status === 0 || error?.name === 'HttpErrorResponse') {
      const loadingSpinners = document.querySelectorAll('.loading-indicator');
      loadingSpinners.forEach(spinner => spinner.classList.add('hidden'));
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

    // Enable Firebase Analytics
    provideAnalytics(() => getAnalytics()),

    // Initialize Firebase Auth with durable persistence
    provideAuth(() => {
      const app = getApp();
      return initializeAuth(app, {
        persistence: [indexedDBLocalPersistence, browserLocalPersistence],
        popupRedirectResolver: browserPopupRedirectResolver,
      });
    }),

    // Provide HttpClient with ApiInterceptor
    provideHttpClient(withInterceptors([ApiInterceptor])),

    // Provide NSwag API Service
    NutritionAmbitionApiService,

    // Provide API_BASE_URL using factory function
    { provide: API_BASE_URL, useFactory: getAPIBaseUrl },

    // Screen & User tracking services
    ScreenTrackingService,
    UserTrackingService, provideServiceWorker('ngsw-worker.js', {
            enabled: !isDevMode(),
            registrationStrategy: 'registerWhenStable:30000'
          }),
  ],
});

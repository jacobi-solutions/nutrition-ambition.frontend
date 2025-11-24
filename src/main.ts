import { enableProdMode, ErrorHandler, Injectable, isDevMode } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
import { RouteReuseStrategy } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular/standalone';
import { Capacitor } from '@capacitor/core';

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

// Suppress Google Identity Services errors in native environments
// This prevents GIS initialization errors from halting Angular bootstrap on iOS/Android
window.addEventListener("error", (e) => {
  const errorString = String(e.error || e.message || '');
  const isGoogleError = errorString.includes('gapi') ||
                        errorString.includes('google') ||
                        errorString.includes('gsi') ||
                        errorString.includes('accounts.google.com');

  if (isGoogleError && Capacitor.isNativePlatform()) {
    console.warn('⚠️ Suppressed Google Identity error in native environment:', errorString);
    e.preventDefault();
  }
});

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
      const isNative = Capacitor.isNativePlatform();

      // Configure auth differently for web vs native to prevent Google Identity issues
      const authConfig: any = {
        persistence: [indexedDBLocalPersistence, browserLocalPersistence],
      };

      // Only add popupRedirectResolver on web platforms
      // On native (iOS/Android), this can trigger Google Identity Services and cause blank screens
      if (!isNative) {
        authConfig.popupRedirectResolver = browserPopupRedirectResolver;
      }

      const auth = initializeAuth(app, authConfig);

      // Set the tenant ID dynamically
      if (environment.tenantId) {
        auth.tenantId = environment.tenantId;
        console.log('✅ Using Firebase tenant:', environment.tenantId, isNative ? '(native)' : '(web)');
      } else {
        console.log('✅ Using default Firebase tenant', isNative ? '(native)' : '(web)');
      }

      return auth;
    }),

    // Provide HttpClient with ApiInterceptor
    provideHttpClient(withInterceptors([ApiInterceptor])),

    // Provide NSwag API Service
    NutritionAmbitionApiService,

    // Provide API_BASE_URL using factory function
    { provide: API_BASE_URL, useFactory: getAPIBaseUrl },

    // Screen & User tracking services
    ScreenTrackingService,
    UserTrackingService,
  ],
});

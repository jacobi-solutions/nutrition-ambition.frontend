// src/main.ts

import { enableProdMode } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
import { RouteReuseStrategy } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular/standalone';

// Firebase and AngularFire imports
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { provideAuth, getAuth } from '@angular/fire/auth';

import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { AuthInterceptor } from './app/services/auth.interceptor';

import { InjectionToken } from '@angular/core';
import { DigamStarterAppApiService, API_BASE_URL } from './app/services/nutrition-ambition-api.service';
import { environment } from './environments/environment';

// Provide the API base URL
export function getAPIBaseUrl(): string {
  return environment.backendApiUrl;  // Adjust based on your actual environment variable
}

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular(),
    provideRouter(routes, withPreloading(PreloadAllModules)),

    // Initialize Firebase App
    provideFirebaseApp(() => initializeApp(environment.firebase)),

    // Initialize Firebase Authentication
    provideAuth(() => getAuth()),

    // Provide HttpClient with AuthInterceptor
    provideHttpClient(withInterceptors([AuthInterceptor])),

    // ✅ Provide NSwag API Service
    DigamStarterAppApiService,

    // ✅ Provide API_BASE_URL using factory function
    { provide: API_BASE_URL, useFactory: getAPIBaseUrl },
  ],
}).catch(err => console.error(err));


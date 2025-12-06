import { inject, Injectable } from '@angular/core';
import { Auth, signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, onIdTokenChanged, signInAnonymously, linkWithCredential, EmailAuthProvider, reauthenticateWithCredential } from '@angular/fire/auth';
import { setPersistence, indexedDBLocalPersistence, sendPasswordResetEmail, confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth';
import { Observable, BehaviorSubject, first } from 'rxjs';
import { Router } from '@angular/router';
import { environment } from 'src/environments/environment';
import { NutritionAmbitionApiService, ChangePasswordRequest, RegisterAccountRequest } from './nutrition-ambition-api.service';
import { AnalyticsService } from './analytics.service';
import { isNativePlatform } from '../utils/platform.utils';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private authInstance = inject(Auth);
  private _apiService = inject(NutritionAmbitionApiService);
  private _router = inject(Router);
  private _analytics = inject(AnalyticsService); // Firebase Analytics tracking

  // UI coordination: last attempted route and one-time notice
  private _lastAttemptedRoute: string | null = null;
  private _authNotice$ = new BehaviorSubject<string | null>(null);
  public readonly authNotice$ = this._authNotice$.asObservable();

  private _userEmailSubject = new BehaviorSubject<string | null>(null);
  userEmail$: Observable<string | null> = this._userEmailSubject.asObservable();

  private _userUidSubject = new BehaviorSubject<string | null>(null);
  userUid$: Observable<string | null> = this._userUidSubject.asObservable();

  private _authReadySubject = new BehaviorSubject<boolean>(false);
  authReady$ = this._authReadySubject.asObservable();

  // Tracks whether the user intentionally signed out
  private _manualSignOut = false;

  // Tracks an in-flight anonymous initialization to dedupe concurrent calls
  private _anonInFlight: Promise<void> | null = null;

  // Emits when authentication is required (e.g., after manual or unexpected sign out)
  private _authRequired$ = new BehaviorSubject<boolean>(false);
  public authRequired$ = this._authRequired$.asObservable();

  constructor() {
    this.authInstance = inject(Auth);
    console.log('[AuthService] Constructor called, URL:', window.location.href);

    // Ensure durable persistence at runtime as a safety net alongside bootstrap config
    setPersistence(this.authInstance, indexedDBLocalPersistence)
      .then(() => {
        console.log('[AuthService] IndexedDB persistence set successfully');
      })
      .catch((error) => {
        console.error('[AuthService] Failed to set IndexedDB persistence:', error);
      });

    // Listen for auth state changes (login/logout, anonymous/registered)
    onAuthStateChanged(this.authInstance, user => {
      console.log('[AuthService] onAuthStateChanged fired, user:', user ? user.uid : 'null');
      this._userEmailSubject.next(user?.email ?? null);
      this._userUidSubject.next(user?.uid ?? null);

      if (user) {
        console.log('[AuthService] User authenticated:', user.uid, user.email);
        if (environment.authDebug) {
        }
        this._authRequired$.next(false);
      } else {
        console.log('[AuthService] No user - auth required');
        if (environment.authDebug) {
        }
        // Manual sign-out or unexpected session loss → require auth UI
        this._authRequired$.next(true);
      }

      console.log('[AuthService] Setting authReady to true');
      this._authReadySubject.next(true); // auth initialized after first event
    });

    // Listen for ID token changes (refresh, credential link, etc.) to keep subjects fresh
    onIdTokenChanged(this.authInstance, user => {
      this._userEmailSubject.next(user?.email ?? null);
      this._userUidSubject.next(user?.uid ?? null);
    });
  }

  async isAuthenticated(): Promise<boolean> {
    // Wait for Firebase Auth initialization
    const isReady = this._authReadySubject.value;
    if (!isReady) {
      await new Promise<void>(resolve => {
        const sub = this.authReady$.subscribe(ready => {
          if (ready) {
            resolve();
            sub.unsubscribe();
          }
        });
      });
    }
  
    return !!this.authInstance.currentUser;
  }
  

  async registerWithEmail(email: string, password: string): Promise<void> {
    try {
      const currentUser = this.authInstance.currentUser;
      
      // Check if we have an anonymous user to upgrade
      if (currentUser && currentUser.isAnonymous) {
        
        // Create EmailAuthCredential
        const credential = EmailAuthProvider.credential(email, password);
        
        // Link the anonymous account with the email credential
        const result = await linkWithCredential(currentUser, credential);
      } else {
        // No anonymous user, create a new account
        const result = await createUserWithEmailAndPassword(this.authInstance, email, password);
      }
      
      // NOW CREATE THE BACKEND ACCOUNT EXPLICITLY
      await this.createBackendAccount(email, false);
      
      // Firebase Analytics: Track successful registration/login
      this._analytics.trackAuthEvent('login');
      
      return Promise.resolve();
    } catch (error) {
      return Promise.reject(error);
    }
  }

  async resetPassword(email: string): Promise<void> {
    try {
      await sendPasswordResetEmail(this.authInstance, email);
      this.setAuthNotice('Password reset email sent. Please check your inbox.');
    } catch (error) {
      throw error;
    }
  }

  async verifyPasswordResetCode(oobCode: string): Promise<string> {
    try {
      const email = await verifyPasswordResetCode(this.authInstance, oobCode);
      return email;
    } catch (error) {
      
      // Provide more specific error messages for common Firebase auth errors
      if (error && typeof error === 'object' && 'code' in error) {
        const firebaseError = error as any;
        switch (firebaseError.code) {
          case 'auth/expired-action-code':
            throw new Error('This password reset link has expired. Please request a new one.');
          case 'auth/invalid-action-code':
            throw new Error('This password reset link is invalid. Please request a new one.');
          case 'auth/user-disabled':
            throw new Error('This account has been disabled.');
          case 'auth/user-not-found':
            throw new Error('No account found for this reset link.');
          default:
            throw new Error(firebaseError.message || 'Invalid reset link');
        }
      }
      
      throw error;
    }
  }

  async confirmPasswordReset(oobCode: string, newPassword: string): Promise<void> {
    try {
      await confirmPasswordReset(this.authInstance, oobCode, newPassword);
    } catch (error) {
      
      // Provide more specific error messages for common Firebase auth errors
      if (error && typeof error === 'object' && 'code' in error) {
        const firebaseError = error as any;
        switch (firebaseError.code) {
          case 'auth/expired-action-code':
            throw new Error('This password reset link has expired. Please request a new one.');
          case 'auth/invalid-action-code':
            throw new Error('This password reset link is invalid. Please request a new one.');
          case 'auth/user-disabled':
            throw new Error('This account has been disabled.');
          case 'auth/user-not-found':
            throw new Error('No account found for this reset link.');
          case 'auth/weak-password':
            throw new Error('Password is too weak. Please choose a stronger password.');
          default:
            throw new Error(firebaseError.message || 'Failed to reset password');
        }
      }
      
      throw error;
    }
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    try {
      const user = this.authInstance.currentUser;
      if (!user || !user.email) {
        throw new Error('User not authenticated or email not available');
      }

      // First, re-authenticate the user with their current password
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      
      // If re-authentication succeeds, call the backend to change the password
      const request = new ChangePasswordRequest({
        newPassword: newPassword
      });
      
      const result = await this._apiService.changePassword(request).toPromise();
      
      if (result && !result.isSuccess) {
        throw new Error(result.errors?.join(', ') || 'Failed to change password');
      }
      
    } catch (error) {
      
      // Provide more specific error messages for common Firebase auth errors
      if (error && typeof error === 'object' && 'code' in error) {
        const firebaseError = error as any;
        switch (firebaseError.code) {
          case 'auth/wrong-password':
            throw new Error('Current password is incorrect');
          case 'auth/too-many-requests':
            throw new Error('Too many failed attempts. Please try again later');
          case 'auth/requires-recent-login':
            throw new Error('Please log out and log back in, then try again');
          default:
            throw new Error(firebaseError.message || 'Failed to change password');
        }
      }
      
      throw error;
    }
  }

  async getIdToken(): Promise<string | null> {
    const user = this.authInstance.currentUser;
    return user ? await user.getIdToken() : null;
  }

  async getFreshIdToken(forceRefresh: boolean = false): Promise<string | null> {
    const user = this.authInstance.currentUser;
    return user ? await user.getIdToken(forceRefresh) : null;
  }

  public isAnonymous(): boolean {
    return !!this.authInstance.currentUser?.isAnonymous;
  }

  // Last-attempted-route helpers
  public setLastAttemptedRoute(url: string): void {
    this._lastAttemptedRoute = url;
  }

  public consumeLastAttemptedRoute(defaultRoute: string = '/app/chat'): string {
    const route = this._lastAttemptedRoute || defaultRoute;
    this._lastAttemptedRoute = null;
    return route;
  }

  public peekLastAttemptedRoute(): string | null {
    return this._lastAttemptedRoute;
  }

  public clearLastAttemptedRoute(): void {
    this._lastAttemptedRoute = null;
  }

  // Auth notice helpers
  public setAuthNotice(message: string | null): void {
    this._authNotice$.next(message);
  }

  public consumeAuthNotice(): string | null {
    const message = this._authNotice$.getValue();
    this._authNotice$.next(null);
    return message;
  }

  private async createBackendAccount(email: string | null, isAnonymous: boolean): Promise<void> {
    try {
      console.log('[AuthService] createBackendAccount starting, isAnonymous:', isAnonymous);
      const request = new RegisterAccountRequest({
        email: email || '',
        timeZoneId: Intl.DateTimeFormat().resolvedOptions().timeZone,
        isAnonymous: isAnonymous
      });

      const response = await this._apiService.registerAccount(request).toPromise();
      console.log('[AuthService] createBackendAccount completed, success:', response?.isSuccess);

      if (!response?.isSuccess) {
        const errorMessage = response?.errors?.[0]?.errorMessage || 'Failed to create backend account';
        throw new Error(errorMessage);
      }

    } catch (error) {
      throw error;
    }
  }

  // DEPRECATED as an automatic pathway. Call startAnonymousSession() only from explicit user intent (e.g., "Continue as guest").
  async ensureAnonymousSession(): Promise<void> {
    return this.startAnonymousSession();
  }

  // Explicit, idempotent, concurrency-safe anonymous session start
  public async startAnonymousSession(): Promise<void> {
    const current = this.authInstance.currentUser;

    // Already authenticated with a real user
    if (current && !current.isAnonymous) {
      if (environment.authDebug) {
      }
      return;
    }

    // Already anonymous
    if (current && current.isAnonymous) {
      if (environment.authDebug) {
      }
      return;
    }

    // Dedupe concurrent calls
    if (this._anonInFlight) {
      if (environment.authDebug) {
      }
      await this._anonInFlight;
      return;
    }

    this._anonInFlight = (async () => {
      try {
        const credential = await signInAnonymously(this.authInstance);
        if (environment.authDebug) {
        }
        
        // NOW CREATE THE BACKEND ACCOUNT FOR ANONYMOUS USER
        await this.createBackendAccount(null, true);
        
        this._authRequired$.next(false);
      } catch (error) {
        throw error;
      } finally {
        this._anonInFlight = null;
      }
    })();

    return this._anonInFlight;
  }

  async signInWithGoogle(): Promise<void> {
    // Prevent Google sign-in on native platforms to avoid blank screen issues
    // Google Identity Services (GIS) causes iOS/Android to hang during initialization
    if (isNativePlatform()) {
      console.warn('⚠️ Google sign-in is not supported on native platforms. Use email/password instead.');
      throw new Error('Google sign-in is only available on web. Please use email/password authentication.');
    }

    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(this.authInstance, provider);

      // For Google sign-in, we need to create backend account if it's a new user
      // Note: Google sign-in could be either login or signup, so we'll try to create
      // the account and handle the "user already exists" gracefully
      try {
        await this.createBackendAccount(result.user.email, false);
      } catch (error: any) {
        // If account already exists, that's fine - user is just logging in
        if (!error?.message?.includes('already exists')) {
          throw error; // Re-throw if it's a different error
        }
      }
      
      // Firebase Analytics: Track successful login
      this._analytics.trackAuthEvent('login');
    } catch (error) {
      throw error;
    }
  }

  async signInWithEmail(email: string, password: string): Promise<void> {
    try {
      await signInWithEmailAndPassword(this.authInstance, email, password);
      
      // Firebase Analytics: Track successful login
      this._analytics.trackAuthEvent('login');
    } catch (error) {
    }
  }

  async signOutUser(): Promise<void> {
    this._manualSignOut = true;
    try {
      await signOut(this.authInstance);
      if (environment.authDebug) {
      }

      // Firebase Analytics: Track successful logout
      this._analytics.trackAuthEvent('logout');

      // After successful sign-out, require auth UI and route to login
      try {
        const currentRoute = this._router.url;
        this.setLastAttemptedRoute(currentRoute);
        this.setAuthNotice("You've been signed out.");
      } catch {}
      this._authRequired$.next(true);
      this._router.navigate(['/login']);
    } catch (error) {
      if (environment.authDebug) {
      }
    } finally {
      this._manualSignOut = false;
      this._anonInFlight = null;
    }
  }

}

import { inject, Injectable } from '@angular/core';
import { Auth, signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, onIdTokenChanged, signInAnonymously, linkWithCredential, EmailAuthProvider } from '@angular/fire/auth';
import { setPersistence, indexedDBLocalPersistence } from 'firebase/auth';
import { Observable, BehaviorSubject, first } from 'rxjs';
import { NutritionAmbitionApiService } from './nutrition-ambition-api.service';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private authInstance = inject(Auth);
  private _apiService = inject(NutritionAmbitionApiService);

  private _userEmailSubject = new BehaviorSubject<string | null>(null);
  userEmail$: Observable<string | null> = this._userEmailSubject.asObservable();

  private _userUidSubject = new BehaviorSubject<string | null>(null);
  userUid$: Observable<string | null> = this._userUidSubject.asObservable();

  private _authReadySubject = new BehaviorSubject<boolean>(false);
  authReady$ = this._authReadySubject.asObservable();

  private _ensureAnonAttempted = false;

  constructor() {
    this.authInstance = inject(Auth);

    // Ensure durable persistence at runtime as a safety net alongside bootstrap config
    setPersistence(this.authInstance, indexedDBLocalPersistence)
      .then(() => {
        console.log('Auth persistence set to IndexedDB (durable).');
      })
      .catch((error) => {
        console.warn('Failed to set auth persistence to IndexedDB.', error);
      });

    // Listen for auth state changes (login/logout, anonymous/registered)
    onAuthStateChanged(this.authInstance, user => {
      this._userEmailSubject.next(user?.email ?? null);
      this._userUidSubject.next(user?.uid ?? null);
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
        console.log('Upgrading anonymous user to email/password account');
        console.log('UID before linking:', currentUser.uid); // 🔍 Log UID before linking
        
        // Create EmailAuthCredential
        const credential = EmailAuthProvider.credential(email, password);
        
        // Link the anonymous account with the email credential
        const result = await linkWithCredential(currentUser, credential);
        console.log('UID after linking:', result.user.uid); // 🔍 Log UID after linking
        console.log('Anonymous account successfully upgraded to email/password account');
      } else {
        // No anonymous user, create a new account
        console.log('Creating new email/password account');
        const result = await createUserWithEmailAndPassword(this.authInstance, email, password);
        console.log('New account UID:', result.user.uid); // 🔍 Log new account UID
        console.log('Email/password account created successfully');
      }
      
      // Backend registration no longer needed as it will happen automatically
      // via the ID token in subsequent API calls
      
      return Promise.resolve();
    } catch (error) {
      console.error('Error during email registration:', error);
      return Promise.reject(error);
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

  async ensureAnonymousSession(): Promise<void> {
    if (this.authInstance.currentUser) {
      return; // User already present (anonymous or registered)
    }
    if (this._ensureAnonAttempted) {
      return; // Already attempted; avoid repeated calls
    }
    this._ensureAnonAttempted = true;
    try {
      const credential = await signInAnonymously(this.authInstance);
      console.log('Anonymous session established. uid:', credential.user.uid);
    } catch (error) {
      console.error('Anonymous sign-in failed:', error);
    }
  }

  async signInWithGoogle(): Promise<void> {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(this.authInstance, provider);
      console.log('Google sign-in successful');
    } catch (error) {
      console.error('Google sign-in failed:', error);
    }
  }

  async signInWithEmail(email: string, password: string): Promise<void> {
    try {
      await signInWithEmailAndPassword(this.authInstance, email, password);
      console.log('Email sign-in successful');
    } catch (error) {
      console.error('Email sign-in failed:', error);
    }
  }

  async signOutUser(): Promise<void> {
    try {
      await signOut(this.authInstance);
      console.log('User signed out successfully');
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  }
}

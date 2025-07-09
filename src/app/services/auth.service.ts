import { inject, Injectable, effect } from '@angular/core';
import { Auth, signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, getIdToken, onAuthStateChanged, signInAnonymously, linkWithCredential, EmailAuthProvider } from '@angular/fire/auth';
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

  private _authReadySubject = new BehaviorSubject<boolean>(false);
  authReady$ = this._authReadySubject.asObservable();

  constructor() {
    this.authInstance = inject(Auth);

    onAuthStateChanged(this.authInstance, user => {
      if (user) {
        this._userEmailSubject.next(user.email ?? null);
      } else {
        this._userEmailSubject.next(null);
      }
      this._authReadySubject.next(true); // ✅ auth system has initialized
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
    let user = this.authInstance.currentUser;
    
    if (!user) {
      try {
        const credential = await signInAnonymously(this.authInstance);
        user = credential.user;
      } catch (error) {
        console.error('Anonymous sign-in failed:', error);
        return null;
      }
    }
    
    return user ? await getIdToken(user) : null;
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

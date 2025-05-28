import { inject, Injectable, effect } from '@angular/core';
import { Auth, signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, getIdToken, onAuthStateChanged } from '@angular/fire/auth';
import { Observable, BehaviorSubject } from 'rxjs';
import { AccountRequest, NutritionAmbitionApiService, Response } from './nutrition-ambition-api.service';

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

  isAuthenticated(): boolean {
    return !!this.authInstance.currentUser;
  }

  async registerWithEmail(email: string, password: string): Promise<void> {
    const userCredential = await createUserWithEmailAndPassword(this.authInstance, email, password);
    const token = await userCredential.user.getIdToken();

    const request = new AccountRequest({
      username: email,
      email: email,
    });

    return new Promise<void>((resolve, reject) => {
      this._apiService.registerUser(request).subscribe((response: Response) => {
        if (response.isSuccess) {
          resolve();
        } else {
          reject(response.errors);
        }
      });
    });
  }

  async getIdToken(): Promise<string | null> {
    const user = this.authInstance.currentUser;
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

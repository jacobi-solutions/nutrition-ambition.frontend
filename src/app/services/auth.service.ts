import { inject, Injectable } from '@angular/core';
import { Auth, signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, getIdToken, onAuthStateChanged, setPersistence, browserLocalPersistence } from '@angular/fire/auth';
import { Observable, BehaviorSubject } from 'rxjs';
import { AccountRequest, NutritionAmbitionApiService, Response } from './nutrition-ambition-api.service';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  userSubject: Observable<any>;
  userEmailSubject: BehaviorSubject<string | null> = new BehaviorSubject<string | null>(null);
  userEmail: string | null = null;
  private authInstance: Auth;

  constructor(private _apiService: NutritionAmbitionApiService) {
    this.authInstance = inject(Auth);
    
    onAuthStateChanged(this.authInstance, user => {
      if (user) {
        this.userEmail = user.email ?? null;
        this.userEmailSubject.next(this.userEmail);
        console.log('User email:', this.userEmail);
      } else {
        this.userEmail = null;
        this.userEmailSubject.next(null);
      }
    });
    
  }

  isAuthenticated(): boolean {
    return !!this.authInstance.currentUser;
  }

  async registerWithEmail(email: string, password: string): Promise<void> {
    if (!this.authInstance) throw new Error("Firebase Auth not initialized"); // ✅ Ensure Auth is ready

    const userCredential = await createUserWithEmailAndPassword(this.authInstance, email, password);
    const token = await userCredential.user.getIdToken();

    const request = new AccountRequest({
      username: email,
      email: email
    });

    return new Promise<void>((resolve, reject) => {
      this._apiService.register(request).subscribe((response: Response) => {
        if (response.isSuccess) {
          resolve();
        } else {
          reject(response.errors);
        }
      });
    });
  }

  async getIdToken(): Promise<string | null> {
    // return this._zone.runOutsideAngular(async () => {
      const user = await this.authInstance.currentUser;
      return user ? await getIdToken(user) : null;
    // });
  }

  // Sign in with Google
  async signInWithGoogle(): Promise<void> {
    if (!this.authInstance) throw new Error("Firebase Auth not initialized"); // ✅ Ensure Auth is ready

    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(this.authInstance, provider);
      console.log('Google sign-in successful');
    } catch (error) {
      console.error('Google sign-in failed:', error);
    }
  }

  // Sign in with Email and Password
  async signInWithEmail(email: string, password: string): Promise<void> {
    if (!this.authInstance) throw new Error("Firebase Auth not initialized"); // ✅ Ensure Auth is ready

    try {
      await signInWithEmailAndPassword(this.authInstance, email, password);
      console.log('Email sign-in successful');
    } catch (error) {
      console.error('Email sign-in failed:', error);
    }
  }

  // Sign out
  async signOutUser(): Promise<void> {
    if (!this.authInstance) throw new Error("Firebase Auth not initialized"); // ✅ Ensure Auth is ready

    try {
      await signOut(this.authInstance);
      console.log('User signed out successfully.');
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  }
}

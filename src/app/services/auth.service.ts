import { inject, Injectable } from '@angular/core';
import { Auth, signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, getIdToken, onAuthStateChanged } from '@angular/fire/auth';
import { Observable, from } from 'rxjs';
import { AccountRequest, DigamStarterAppApiService, Response } from './nutrition-ambition-api.service';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  user$: Observable<any>;
  private authInstance: Auth;

  constructor(private _apiService: DigamStarterAppApiService) {
    this.authInstance = inject(Auth); // ✅ Ensure Auth is initialized
    this.user$ = new Observable(observer => {
      onAuthStateChanged(this.authInstance, user => {
        observer.next(user);
        observer.complete();
      });
    });
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

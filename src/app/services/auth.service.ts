import { inject, Injectable } from '@angular/core';
import { Auth, signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, onIdTokenChanged, signInAnonymously, linkWithCredential, EmailAuthProvider } from '@angular/fire/auth';
import { setPersistence, indexedDBLocalPersistence } from 'firebase/auth';
import { Observable, BehaviorSubject, first } from 'rxjs';
import { Router } from '@angular/router';
import { environment } from 'src/environments/environment';
import { NutritionAmbitionApiService } from './nutrition-ambition-api.service';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private authInstance = inject(Auth);
  private _apiService = inject(NutritionAmbitionApiService);
  private _router = inject(Router);

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

      if (user) {
        if (environment.authDebug) {
          // eslint-disable-next-line no-console
          console.debug('Auth state: user present');
        }
        this._authRequired$.next(false);
      } else {
        if (environment.authDebug) {
          // eslint-disable-next-line no-console
          console.debug(`Auth state: user null (manualSignOut=${this._manualSignOut})`);
        }
        // Manual sign-out or unexpected session loss → require auth UI
        this._authRequired$.next(true);
      }

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
        // eslint-disable-next-line no-console
        console.debug('startAnonymousSession: already authenticated (non-anon). Skipping.');
      }
      return;
    }

    // Already anonymous
    if (current && current.isAnonymous) {
      if (environment.authDebug) {
        // eslint-disable-next-line no-console
        console.debug('startAnonymousSession: already anonymous. Skipping.');
      }
      return;
    }

    // Dedupe concurrent calls
    if (this._anonInFlight) {
      if (environment.authDebug) {
        // eslint-disable-next-line no-console
        console.debug('startAnonymousSession: awaiting in-flight anon init');
      }
      await this._anonInFlight;
      return;
    }

    this._anonInFlight = (async () => {
      try {
        const credential = await signInAnonymously(this.authInstance);
        if (environment.authDebug) {
          // eslint-disable-next-line no-console
          console.debug('startAnonymousSession: anonymous session established. uid:', credential.user.uid);
        }
        this._authRequired$.next(false);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('startAnonymousSession: anonymous sign-in failed:', error);
        throw error;
      } finally {
        this._anonInFlight = null;
      }
    })();

    return this._anonInFlight;
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
    this._manualSignOut = true;
    try {
      await signOut(this.authInstance);
      if (environment.authDebug) {
        // eslint-disable-next-line no-console
        console.debug('signOutUser: user signed out successfully');
      }
      // After successful sign-out, require auth UI and route to login
      try {
        const currentRoute = this._router.url;
        this.setLastAttemptedRoute(currentRoute);
        this.setAuthNotice("You’ve been signed out.");
      } catch {}
      this._authRequired$.next(true);
      this._router.navigate(['/login']);
    } catch (error) {
      if (environment.authDebug) {
        // eslint-disable-next-line no-console
        console.warn('signOutUser: sign out failed', error);
      }
    } finally {
      this._manualSignOut = false;
      this._anonInFlight = null;
    }
  }
}

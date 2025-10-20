import { Routes } from '@angular/router';
import { LoginPage } from './pages/auth/login/login.page';
import { SignupPage } from './pages/auth/signup/signup.page';
import { AuthGuard } from './guards/auth.guard';
import { OwnerGuard } from './guards/owner.guard';

export const routes: Routes = [
  {
    path: 'login',
    component: LoginPage
  },
  {
    path: 'signup',
    component: SignupPage,
    // Note: AuthGuard might need adjustment if registration is public
  },
  {
    path: 'beta-signup',
    loadComponent: () => import('./pages/auth/beta-signup/beta-signup.page').then(m => m.BetaSignupPage)
  },
  {
    path: 'legal',
    loadComponent: () => import('./pages/legal/legal.page').then(m => m.LegalPage)
  },
  {
    path: 'legal/privacy-policy',
    loadComponent: () => import('./pages/legal/privacy-policy/privacy-policy.page').then(m => m.PrivacyPolicyPage)
  },
  {
    path: 'legal/terms-of-service',
    loadComponent: () => import('./pages/legal/terms-of-service/terms-of-service.page').then(m => m.TermsOfServicePage)
  },
  {
    path: 'change-password',
    loadComponent: () => import('./pages/auth/change-password/change-password.page').then(m => m.ChangePasswordPage),
    canActivate: [AuthGuard]
  },
  {
    path: 'forgot-password-reset',
    loadComponent: () => import('./pages/auth/forgot-password-reset/forgot-password-reset.page').then(m => m.ForgotPasswordResetPage)
  },
  {
    path: 'auth-action',
    loadComponent: () => import('./pages/auth/firebase-action/firebase-action.page').then(m => m.FirebaseActionPage)
  },
  {
    path: 'share/:token',
    loadComponent: () => import('./pages/chat/chat.page').then(m => m.ChatPage),
    canActivate: [AuthGuard]
  },
  {
    path: 'admin',
    loadComponent: () => import('./admin/pages/admin/admin.page').then(m => m.AdminPage),
    canActivate: [AuthGuard, OwnerGuard]
  },
  {
    path: 'debug/:feedbackId/:accountId',
    loadComponent: () => import('./admin/pages/debug/debug.page').then(m => m.DebugPage),
    canActivate: [AuthGuard, OwnerGuard]
  },
  {
    path: 'app',
    loadComponent: () => import('./pages/tabs/tabs.page').then(m => m.TabsPage),
    canActivate: [AuthGuard],
    children: [
      {
        path: 'chat',
        loadComponent: () => import('./pages/chat/chat.page').then(m => m.ChatPage)
      },
      {
        path: 'summary',
        loadComponent: () => import('./pages/daily-summary/daily-summary.page').then(m => m.DailySummaryPage)
      },
      {
        path: '',
        redirectTo: 'chat',
        pathMatch: 'full'
      }
    ]
  },
  {
    path: '',
    redirectTo: '/app/chat',
    pathMatch: 'full'
  }
];


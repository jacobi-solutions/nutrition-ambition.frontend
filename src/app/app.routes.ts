import { Routes } from '@angular/router';
import { LoginPage } from './pages/auth/login/login.page';
import { SignupPage } from './pages/auth/signup/signup.page';
import { AuthGuard } from './guards/auth.guard';
import { OwnerGuard } from './guards/owner.guard';
import { DailySummaryComponent } from './pages/daily-summary/daily-summary.component';

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
    path: 'admin',
    loadComponent: () => import('./pages/admin/admin.page').then(m => m.AdminPage),
    canActivate: [AuthGuard, OwnerGuard]
  },
  {
    path: 'app',
    loadComponent: () => import('./pages/tabs/tabs.page').then(m => m.TabsPage),
    children: [
      {
        path: 'chat',
        loadComponent: () => import('./pages/chat/chat.page').then(m => m.ChatPage)
      },
      {
        path: 'summary',
        component: DailySummaryComponent
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


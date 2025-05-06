import { Routes } from '@angular/router';
import { LoginPage } from './pages/auth/login/login.page';
import { RegisterPage } from './pages/auth/register/register.page';
import { AuthGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    component: LoginPage
  },
  {
    path: 'register',
    component: RegisterPage,
    // Note: AuthGuard might need adjustment if registration is public
  },
  {
    path: 'app',
    canActivate: [AuthGuard],
    loadComponent: () => import('./pages/tabs/tabs.page').then(m => m.TabsPage),
    children: [
      {
        path: 'chat',
        loadComponent: () => import('./pages/chat/chat.page').then(m => m.ChatPage)
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


import { Routes } from '@angular/router';
import { LoginPage } from './pages/auth/login/login.page';
import { RegisterPage } from './pages/auth/register/register.page';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
  {
    path: 'login',
    component: LoginPage
  },
  {
    path: 'register',
    component: RegisterPage
  },
  {
    path: 'home',
    loadComponent: () => import('./pages/home/home.page').then( m => m.HomePage)
  },
  // ...
];

import { Routes } from '@angular/router';
import { LoginPage } from './pages/auth/login/login.page';
import { RegisterPage } from './pages/auth/register/register.page';
import { AuthGuard } from './guards/auth.guard';
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
    component: RegisterPage,  
    canActivate: [AuthGuard]
  },
  {
    path: 'landing-transparent',
    loadComponent: () => import('./pages/landing-transparent/landing-transparent.page').then( m => m.LandingTransparentPage)
  },
  {
    path: 'food-logging',
    loadComponent: () => import('./pages/food-logging/food-logging.page').then( m => m.FoodLoggingPage),
    canActivate: [AuthGuard]
  }
  // ...
];

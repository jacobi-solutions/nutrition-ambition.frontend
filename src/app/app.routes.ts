import { Routes } from '@angular/router';
import { LoginPage } from './pages/auth/login/login.page';
import { RegisterPage } from './pages/auth/register/register.page';
import { AuthGuard } from './guards/auth.guard';
import { FoodDetailPage } from './pages/food-detail/food-detail.page';
import { FoodGroupDetailPage } from './pages/food-group-detail/food-group-detail.page';

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
    path: 'food-detail',
    component: FoodDetailPage,
    canActivate: [AuthGuard]
  },
  {
    path: 'food-group-detail',
    component: FoodGroupDetailPage,
    canActivate: [AuthGuard]
  },
  // {
  //   path: 'landing-transparent',
  //   loadComponent: () => import('./pages/landing-transparent/landing-transparent.page').then( m => m.LandingTransparentPage)
  // },
  {
    path: 'app', // Parent route for tabs
    canActivate: [AuthGuard],
    loadComponent: () => import('./pages/tabs/tabs.page').then(m => m.TabsPage),
    children: [
      {
        path: 'chat', // Tab 1: Chat
        loadComponent: () => import('./pages/food-logging/food-logging.page').then(m => m.FoodLoggingPage)
      },
      {
        path: 'log', // Tab 2: Nutrition Log
        loadComponent: () => import('./pages/nutrition-log/nutrition-log.page').then(m => m.NutritionLogPage)
      },
      {
        path: '',
        redirectTo: 'chat', // Default tab
        pathMatch: 'full'
      }
    ]
  },
  {
    path: '',
    redirectTo: '/app/chat', // Redirect root to the default tab
    pathMatch: 'full'
  }
];


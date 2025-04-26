import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomePage } from './pages/home/home.page';
import { LoginPage } from './pages/auth/login/login.page';
import { LandingTransparentPage } from './pages/landing-transparent/landing-transparent.page';
import { AuthGuard } from './guards/auth.guard';

const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: 'home', component: HomePage, canActivate: [AuthGuard] },
  { path: 'login', component: LoginPage },
  { path: 'nutrition-transparent', component: LandingTransparentPage },
  // other routes...
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {} 
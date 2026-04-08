import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { guestOnlyGuard } from './core/guards/guest-only.guard';
import { DashboardPageComponent } from './pages/dashboard/dashboard.page';
import { HomePageComponent } from './pages/home/home.page';
import { LoginPageComponent } from './pages/login/login.page';
import { MyClubPageComponent } from './pages/my-club/my-club.page';
import { PacksPageComponent } from './pages/packs/packs.page';
import { RegisterPageComponent } from './pages/register/register.page';

export const routes: Routes = [
  {
    path: '',
    component: HomePageComponent,
    title: 'Pokefifa | Home',
  },
  {
    path: 'login',
    component: LoginPageComponent,
    title: 'Pokefifa | Login',
    canActivate: [guestOnlyGuard],
  },
  {
    path: 'register',
    component: RegisterPageComponent,
    title: 'Pokefifa | Register',
    canActivate: [guestOnlyGuard],
  },
  {
    path: 'dashboard',
    component: DashboardPageComponent,
    title: 'Pokefifa | Dashboard',
    canActivate: [authGuard],
  },
  {
    path: 'packs',
    component: PacksPageComponent,
    title: 'Pokefifa | Packs',
    canActivate: [authGuard],
  },
  {
    path: 'my-club',
    component: MyClubPageComponent,
    title: 'Pokefifa | My Club',
    canActivate: [authGuard],
  },
  {
    path: '**',
    redirectTo: '',
  },
];

import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { guestOnlyGuard } from './core/guards/guest-only.guard';
import { DashboardPageComponent } from './pages/dashboard/dashboard.page';
import { BattlesPageComponent } from './pages/battles/battles.page';
import { HomePageComponent } from './pages/home/home.page';
import { InventoryPageComponent } from './pages/inventory/inventory.page';
import { LoginPageComponent } from './pages/login/login.page';
import { MyClubPageComponent } from './pages/my-club/my-club.page';
import { PacksPageComponent } from './pages/packs/packs.page';
import { RegisterPageComponent } from './pages/register/register.page';
import { SquadPageComponent } from './pages/squad/squad.page';
import { StorePageComponent } from './pages/store/store.page';

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
    path: 'store',
    component: StorePageComponent,
    title: 'Pokefifa | Store',
    canActivate: [authGuard],
  },
  {
    path: 'squad',
    component: SquadPageComponent,
    title: 'Pokefifa | Squad',
    canActivate: [authGuard],
  },
  {
    path: 'battles',
    component: BattlesPageComponent,
    title: 'Pokefifa | Battles',
    canActivate: [authGuard],
  },
  {
    path: 'inventory',
    component: InventoryPageComponent,
    title: 'Pokefifa | Inventory',
    canActivate: [authGuard],
  },
  {
    path: '**',
    redirectTo: '',
  },
];

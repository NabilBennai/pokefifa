import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { TranslatePipe } from '../../shared/pipes/t.pipe';

@Component({
  selector: 'app-home-page',
  imports: [RouterLink, TranslatePipe],
  templateUrl: './home.page.html',
})
export class HomePageComponent {
  protected readonly authService = inject(AuthService);
  protected readonly user = this.authService.user;
  protected readonly isAuthenticated = computed(() => !!this.user());
}

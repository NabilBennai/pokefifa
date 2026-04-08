import { Component, inject } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-dashboard-page',
  templateUrl: './dashboard.page.html',
})
export class DashboardPageComponent {
  protected readonly user = inject(AuthService).user;
}

import { HttpErrorResponse } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { AiBattleResponse, BattleHistoryItem } from '../../core/models/battle.models';
import { Team } from '../../core/models/team.models';
import { AuthService } from '../../core/services/auth.service';
import { BattlesService } from '../../core/services/battles.service';
import { TeamsService } from '../../core/services/teams.service';
import { BattleReplayModalComponent } from '../../shared/components/battle-replay-modal/battle-replay-modal.component';

@Component({
  selector: 'app-battles-page',
  imports: [DatePipe, BattleReplayModalComponent],
  templateUrl: './battles.page.html',
})
export class BattlesPageComponent {
  private readonly battlesService = inject(BattlesService);
  private readonly teamsService = inject(TeamsService);
  private readonly authService = inject(AuthService);

  protected readonly user = this.authService.user;
  protected readonly loading = signal(false);
  protected readonly fighting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly teams = signal<Team[]>([]);
  protected readonly selectedTeamId = signal<string | null>(null);
  protected readonly history = signal<BattleHistoryItem[]>([]);
  protected readonly lastResult = signal<AiBattleResponse | null>(null);
  protected readonly replayOpen = signal(false);

  constructor() {
    this.loadData();
  }

  protected loadData(): void {
    this.loading.set(true);
    this.error.set(null);

    let pending = 2;
    const done = () => {
      pending -= 1;
      if (pending === 0) {
        this.loading.set(false);
      }
    };

    this.teamsService.getMyTeams().subscribe({
      next: (response) => {
        this.teams.set(response.teams);
        if (!this.selectedTeamId()) {
          const preferred = response.teams.find((team) => team.isDefault) ?? response.teams[0];
          this.selectedTeamId.set(preferred?.id ?? null);
        }
        done();
      },
      error: (error: HttpErrorResponse) => {
        this.error.set(error.error?.message ?? 'Could not load teams.');
        done();
      },
    });

    this.battlesService.getMyHistory().subscribe({
      next: (response) => {
        this.history.set(response.battles);
        done();
      },
      error: () => {
        done();
      },
    });
  }

  protected runAiBattle(): void {
    this.error.set(null);
    this.lastResult.set(null);
    this.fighting.set(true);

    this.battlesService
      .runAiBattle(this.selectedTeamId() ?? undefined)
      .pipe(finalize(() => this.fighting.set(false)))
      .subscribe({
        next: (response) => {
          this.lastResult.set(response);
          this.replayOpen.set(true);
          this.authService.refreshProfile().subscribe();
          this.loadData();
        },
        error: (error: HttpErrorResponse) => {
          this.error.set(error.error?.message ?? 'Battle failed.');
        },
      });
  }

  protected teamLabel(team: Team): string {
    return team.isDefault ? `${team.name} (Default)` : team.name;
  }

  protected closeReplay(): void {
    this.replayOpen.set(false);
  }
}

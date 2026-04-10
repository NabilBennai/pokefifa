import { HttpErrorResponse } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { BattleHistoryItem, LiveBattleState } from '../../core/models/battle.models';
import { Team } from '../../core/models/team.models';
import { AuthService } from '../../core/services/auth.service';
import { BattlesService } from '../../core/services/battles.service';
import { TeamsService } from '../../core/services/teams.service';
import { BattleLiveModalComponent } from '../../shared/components/battle-live-modal/battle-live-modal.component';
import { TranslatePipe } from '../../shared/pipes/t.pipe';

@Component({
  selector: 'app-battles-page',
  imports: [DatePipe, BattleLiveModalComponent, TranslatePipe],
  templateUrl: './battles.page.html',
})
export class BattlesPageComponent {
  private readonly battlesService = inject(BattlesService);
  private readonly teamsService = inject(TeamsService);
  private readonly authService = inject(AuthService);

  protected readonly user = this.authService.user;
  protected readonly loading = signal(false);
  protected readonly fighting = signal(false);
  protected readonly actionPending = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly teams = signal<Team[]>([]);
  protected readonly selectedTeamId = signal<string | null>(null);
  protected readonly history = signal<BattleHistoryItem[]>([]);
  protected readonly liveBattle = signal<LiveBattleState | null>(null);
  protected readonly liveOpen = signal(false);

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
    this.liveBattle.set(null);
    this.fighting.set(true);

    this.battlesService
      .startLiveBattle(this.selectedTeamId() ?? undefined)
      .pipe(finalize(() => this.fighting.set(false)))
      .subscribe({
        next: (response) => {
          this.liveBattle.set(response);
          this.liveOpen.set(true);
        },
        error: (error: HttpErrorResponse) => {
          this.error.set(error.error?.message ?? 'Battle failed.');
        },
      });
  }

  protected playMove(moveIndex: number): void {
    const battle = this.liveBattle();
    if (!battle || battle.finished) {
      return;
    }

    this.actionPending.set(true);
    this.battlesService
      .playLiveTurn(battle.battleId, moveIndex)
      .pipe(finalize(() => this.actionPending.set(false)))
      .subscribe({
        next: (state) => {
          this.liveBattle.set(state);
          if (state.finished) {
            this.authService.refreshProfile().subscribe();
            this.loadData();
            setTimeout(() => {
              this.liveOpen.set(false);
              this.liveBattle.set(null);
            }, 1000);
          }
        },
        error: (error: HttpErrorResponse) => {
          this.error.set(error.error?.message ?? 'Turn failed.');
        },
      });
  }

  protected playSwitch(switchIndex: number): void {
    const battle = this.liveBattle();
    if (!battle || battle.finished) {
      return;
    }

    this.actionPending.set(true);
    this.battlesService
      .switchLivePokemon(battle.battleId, switchIndex)
      .pipe(finalize(() => this.actionPending.set(false)))
      .subscribe({
        next: (state) => {
          this.liveBattle.set(state);
          if (state.finished) {
            this.authService.refreshProfile().subscribe();
            this.loadData();
            setTimeout(() => {
              this.liveOpen.set(false);
              this.liveBattle.set(null);
            }, 1000);
          }
        },
        error: (error: HttpErrorResponse) => {
          this.error.set(error.error?.message ?? 'Switch failed.');
        },
      });
  }

  protected playItem(payload: { itemSlug: string; targetIndex?: number }): void {
    const battle = this.liveBattle();
    if (!battle || battle.finished) {
      return;
    }

    this.actionPending.set(true);
    this.battlesService
      .useLiveItem(battle.battleId, payload.itemSlug, payload.targetIndex)
      .pipe(finalize(() => this.actionPending.set(false)))
      .subscribe({
        next: (state) => {
          this.liveBattle.set(state);
          if (state.finished) {
            this.authService.refreshProfile().subscribe();
            this.loadData();
            setTimeout(() => {
              this.liveOpen.set(false);
              this.liveBattle.set(null);
            }, 1000);
          }
        },
        error: (error: HttpErrorResponse) => {
          this.error.set(error.error?.message ?? 'Item action failed.');
        },
      });
  }

  protected teamLabel(team: Team): string {
    return team.isDefault ? `${team.name} (Default)` : team.name;
  }

  protected closeReplay(): void {
    this.liveOpen.set(false);
    this.liveBattle.set(null);
  }
}

import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { LiveBattleState } from '../../core/models/battle.models';
import { RankedOverviewResponse } from '../../core/models/ranked.models';
import { Team } from '../../core/models/team.models';
import { AuthService } from '../../core/services/auth.service';
import { BattlesService } from '../../core/services/battles.service';
import { RankedService } from '../../core/services/ranked.service';
import { TeamsService } from '../../core/services/teams.service';
import { BattleLiveModalComponent } from '../../shared/components/battle-live-modal/battle-live-modal.component';

@Component({
  selector: 'app-ranked-page',
  imports: [DatePipe, BattleLiveModalComponent],
  templateUrl: './ranked.page.html',
})
export class RankedPageComponent {
  private readonly rankedService = inject(RankedService);
  private readonly battlesService = inject(BattlesService);
  private readonly teamsService = inject(TeamsService);
  private readonly authService = inject(AuthService);

  protected readonly user = this.authService.user;
  protected readonly loading = signal(false);
  protected readonly battling = signal(false);
  protected readonly claiming = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);
  protected readonly overview = signal<RankedOverviewResponse | null>(null);
  protected readonly teams = signal<Team[]>([]);
  protected readonly selectedTeamId = signal<string | null>(null);
  protected readonly liveBattle = signal<LiveBattleState | null>(null);
  protected readonly liveOpen = signal(false);
  protected readonly actionPending = signal(false);

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

    this.rankedService.getOverview().subscribe({
      next: (response) => {
        this.overview.set(response);
        done();
      },
      error: (error: HttpErrorResponse) => {
        this.error.set(error.error?.message ?? 'Could not load ranked overview.');
        done();
      },
    });

    this.teamsService.getMyTeams().subscribe({
      next: (response) => {
        this.teams.set(response.teams);
        const preferred = response.teams.find((team) => team.isDefault) ?? response.teams[0];
        this.selectedTeamId.set(preferred?.id ?? null);
        done();
      },
      error: () => done(),
    });
  }

  protected playRanked(): void {
    this.error.set(null);
    this.success.set(null);
    this.liveBattle.set(null);
    this.battling.set(true);

    this.battlesService
      .startLiveRankedBattle(this.selectedTeamId() ?? undefined)
      .pipe(finalize(() => this.battling.set(false)))
      .subscribe({
        next: (response) => {
          this.liveBattle.set(response);
          this.liveOpen.set(true);
        },
        error: (error: HttpErrorResponse) => {
          this.error.set(error.error?.message ?? 'Could not start ranked battle.');
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
            const result =
              state.result ??
              (state.winnerSide === 'A' ? 'WIN' : state.winnerSide === 'B' ? 'LOSS' : 'DRAW');
            const coins = state.rewards?.coins ?? 0;
            const xp = state.rewards?.xp ?? 0;
            const delta = state.ratingDelta ?? 0;
            this.success.set(
              `Ranked match finished: ${result}. +${coins} coins, +${xp} xp, ${delta >= 0 ? '+' : ''}${delta} rating.`,
            );
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
            const result =
              state.result ??
              (state.winnerSide === 'A' ? 'WIN' : state.winnerSide === 'B' ? 'LOSS' : 'DRAW');
            const coins = state.rewards?.coins ?? 0;
            const xp = state.rewards?.xp ?? 0;
            const delta = state.ratingDelta ?? 0;
            this.success.set(
              `Ranked match finished: ${result}. +${coins} coins, +${xp} xp, ${delta >= 0 ? '+' : ''}${delta} rating.`,
            );
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

  protected claimSeasonReward(): void {
    this.error.set(null);
    this.success.set(null);
    this.claiming.set(true);

    this.rankedService
      .claimSeasonReward()
      .pipe(finalize(() => this.claiming.set(false)))
      .subscribe({
        next: (response) => {
          this.success.set(
            `Season rewards claimed: ${response.rewards.coins} coins, ${response.rewards.gems} gems, ${response.rewards.shards} shards, ${response.rewards.packs} packs.`,
          );
          this.authService.refreshProfile().subscribe();
          this.loadData();
        },
        error: (error: HttpErrorResponse) => {
          this.error.set(error.error?.message ?? 'Could not claim season rewards.');
        },
      });
  }

  protected teamLabel(team: Team): string {
    return team.isDefault ? `${team.name} (Default)` : team.name;
  }

  protected closeLive(): void {
    this.liveOpen.set(false);
  }
}

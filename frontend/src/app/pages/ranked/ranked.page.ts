import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, inject, signal } from '@angular/core';
import { Subscription, finalize, firstValueFrom } from 'rxjs';
import { take } from 'rxjs/operators';
import { LiveBattleState } from '../../core/models/battle.models';
import { PvpBattleState } from '../../core/models/pvp.models';
import { RankedOverviewResponse } from '../../core/models/ranked.models';
import { Team } from '../../core/models/team.models';
import { AuthService } from '../../core/services/auth.service';
import { BattlesService } from '../../core/services/battles.service';
import { PvpService } from '../../core/services/pvp.service';
import { RankedService } from '../../core/services/ranked.service';
import { TeamsService } from '../../core/services/teams.service';
import { BattleLiveModalComponent } from '../../shared/components/battle-live-modal/battle-live-modal.component';

@Component({
  selector: 'app-ranked-page',
  imports: [DatePipe, BattleLiveModalComponent],
  templateUrl: './ranked.page.html',
})
export class RankedPageComponent implements OnDestroy {
  private readonly rankedService = inject(RankedService);
  private readonly battlesService = inject(BattlesService);
  private readonly teamsService = inject(TeamsService);
  private readonly authService = inject(AuthService);
  private readonly pvpService = inject(PvpService);
  private readonly pvpSubscriptions = new Subscription();
  private liveCloseTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly user = this.authService.user;
  protected readonly loading = signal(false);
  protected readonly battling = signal(false);
  protected readonly claiming = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);
  protected readonly overview = signal<RankedOverviewResponse | null>(null);
  protected readonly teams = signal<Team[]>([]);
  protected readonly selectedTeamId = signal<string | null>(null);
  protected readonly liveBattle = signal<LiveBattleState | PvpBattleState | null>(null);
  protected readonly liveOpen = signal(false);
  protected readonly actionPending = signal(false);
  protected readonly queueConnected = signal(false);
  protected readonly queueSearching = signal(false);
  protected readonly queueInfo = signal<string | null>(null);
  protected readonly queueError = signal<string | null>(null);

  constructor() {
    this.bindPvpEvents();
    this.loadData();
  }

  ngOnDestroy(): void {
    this.clearLiveCloseTimer();
    this.pvpSubscriptions.unsubscribe();
    this.pvpService.disconnect();
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

    if (this.isPvpBattle(battle)) {
      if (!battle.canAct) {
        this.error.set('Wait for your turn.');
        return;
      }
      this.actionPending.set(true);
      this.pvpService.sendMove(battle.matchId, moveIndex);
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
            this.scheduleLiveClose(1000);
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

    if (this.isPvpBattle(battle)) {
      if (!battle.canAct) {
        this.error.set('Wait for your turn.');
        return;
      }
      this.actionPending.set(true);
      this.pvpService.sendSwitch(battle.matchId, switchIndex);
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
            this.scheduleLiveClose(1000);
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
    this.clearLiveCloseTimer();
    this.liveOpen.set(false);
  }

  protected requestRematch(): void {
    this.clearLiveCloseTimer();
    this.liveOpen.set(false);
    this.liveBattle.set(null);
    void this.joinPvpQueue();
  }

  protected async joinPvpQueue(): Promise<void> {
    this.queueError.set(null);
    this.queueInfo.set(null);

    const accessToken = this.authService.getAccessToken();
    if (!accessToken) {
      this.queueError.set('You must be logged in to queue.');
      return;
    }

    try {
      await this.pvpService.connect(accessToken);
      this.queueConnected.set(true);
      await firstValueFrom(this.pvpService.queueReady$.pipe(take(1)));
      this.pvpService.joinQueue(this.selectedTeamId() ?? undefined);
      this.queueInfo.set('Searching for an opponent...');
    } catch {
      this.queueConnected.set(false);
      this.queueSearching.set(false);
      this.queueError.set('Could not connect to PvP queue.');
    }
  }

  protected leavePvpQueue(): void {
    this.pvpService.leaveQueue();
    this.pvpService.disconnect();
    this.queueConnected.set(false);
    this.queueSearching.set(false);
    this.queueInfo.set('Queue left.');
  }

  private bindPvpEvents(): void {
    this.pvpSubscriptions.add(
      this.pvpService.queueJoined$.subscribe((event) => {
        this.queueSearching.set(true);
        this.queueInfo.set(`Queued with ${event.queueSize} player(s) in queue.`);
      }),
    );
    this.pvpSubscriptions.add(
      this.pvpService.queueLeft$.subscribe(() => {
        this.queueSearching.set(false);
        this.queueInfo.set('Queue left.');
      }),
    );
    this.pvpSubscriptions.add(
      this.pvpService.queueError$.subscribe((event) => {
        this.queueError.set(event.message);
        this.queueSearching.set(false);
      }),
    );
    this.pvpSubscriptions.add(
      this.pvpService.matchFound$.subscribe((event) => {
        this.queueSearching.set(false);
        this.queueInfo.set(`Matched vs ${event.opponent.username} (${event.opponent.rating}).`);
        this.success.set(`PvP match found against ${event.opponent.username}.`);
        this.pvpService.joinMatch(event.matchId);
      }),
    );
    this.pvpSubscriptions.add(
      this.pvpService.battleState$.subscribe((state) => {
        this.actionPending.set(false);
        this.liveBattle.set(state);
        this.liveOpen.set(true);
        if (state.finished) {
          const result =
            state.result ??
            (state.winnerSide === 'A' ? 'WIN' : state.winnerSide === 'B' ? 'LOSS' : 'DRAW');
          const coins = state.rewards?.coins ?? 0;
          const xp = state.rewards?.xp ?? 0;
          const delta = state.ratingDelta ?? 0;
          this.success.set(
            `PvP finished: ${result}. +${coins} coins, +${xp} xp, ${delta >= 0 ? '+' : ''}${delta} rating.`,
          );
          this.authService.refreshProfile().subscribe();
          this.loadData();
        this.queueConnected.set(false);
          this.scheduleLiveClose(1500);
        }
      }),
    );
    this.pvpSubscriptions.add(
      this.pvpService.battleError$.subscribe((event) => {
        this.actionPending.set(false);
        this.error.set(event.message);
      }),
    );
    this.pvpSubscriptions.add(
      this.pvpService.disconnected$.subscribe(() => {
        this.queueConnected.set(false);
        this.queueSearching.set(false);
      }),
    );
  }

  private isPvpBattle(battle: LiveBattleState | PvpBattleState): battle is PvpBattleState {
    return 'matchId' in battle;
  }

  private scheduleLiveClose(delayMs: number): void {
    this.clearLiveCloseTimer();
    this.liveCloseTimer = setTimeout(() => {
      this.liveOpen.set(false);
      this.liveBattle.set(null);
      this.liveCloseTimer = null;
    }, delayMs);
  }

  private clearLiveCloseTimer(): void {
    if (!this.liveCloseTimer) {
      return;
    }
    clearTimeout(this.liveCloseTimer);
    this.liveCloseTimer = null;
  }
}

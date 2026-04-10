import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../tokens/api-base-url.token';
import { AiBattleResponse, BattleHistoryResponse, LiveBattleState } from '../models/battle.models';

@Injectable({ providedIn: 'root' })
export class BattlesService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  runAiBattle(teamId?: string): Observable<AiBattleResponse> {
    return this.http.post<AiBattleResponse>(
      `${this.apiBaseUrl}/battles/ai`,
      teamId ? { teamId } : {},
    );
  }

  runRankedBattle(teamId?: string): Observable<AiBattleResponse> {
    return this.http.post<AiBattleResponse>(
      `${this.apiBaseUrl}/battles/ranked`,
      teamId ? { teamId } : {},
    );
  }

  getMyHistory(): Observable<BattleHistoryResponse> {
    return this.http.get<BattleHistoryResponse>(`${this.apiBaseUrl}/battles/history/me`);
  }

  startLiveBattle(teamId?: string): Observable<LiveBattleState> {
    return this.http.post<LiveBattleState>(
      `${this.apiBaseUrl}/battles/live/start`,
      teamId ? { teamId } : {},
    );
  }

  startLiveRankedBattle(teamId?: string): Observable<LiveBattleState> {
    return this.http.post<LiveBattleState>(
      `${this.apiBaseUrl}/battles/live/ranked/start`,
      teamId ? { teamId } : {},
    );
  }

  getLiveBattle(battleId: string): Observable<LiveBattleState> {
    return this.http.get<LiveBattleState>(`${this.apiBaseUrl}/battles/live/${battleId}`);
  }

  playLiveTurn(battleId: string, moveIndex: number): Observable<LiveBattleState> {
    return this.playLiveAction(battleId, {
      action: 'MOVE',
      moveIndex,
    });
  }

  switchLivePokemon(battleId: string, switchIndex: number): Observable<LiveBattleState> {
    return this.playLiveAction(battleId, {
      action: 'SWITCH',
      switchIndex,
    });
  }

  useLiveItem(
    battleId: string,
    itemSlug: string,
    targetIndex?: number,
  ): Observable<LiveBattleState> {
    return this.playLiveAction(battleId, {
      action: 'ITEM',
      itemSlug,
      targetIndex,
    });
  }

  private playLiveAction(
    battleId: string,
    payload:
      | { action: 'MOVE'; moveIndex: number }
      | { action: 'SWITCH'; switchIndex: number }
      | { action: 'ITEM'; itemSlug: string; targetIndex?: number },
  ): Observable<LiveBattleState> {
    return this.http.post<LiveBattleState>(`${this.apiBaseUrl}/battles/live/${battleId}/action`, {
      ...payload,
    });
  }
}

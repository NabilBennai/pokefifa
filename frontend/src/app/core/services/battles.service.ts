import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../tokens/api-base-url.token';
import { AiBattleResponse, BattleHistoryResponse } from '../models/battle.models';

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
}

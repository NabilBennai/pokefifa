import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  MyCreaturesResponse,
  ResolvePendingMoveResponse,
  UpdateCreatureMovesResponse,
} from '../models/creature.models';
import { API_BASE_URL } from '../tokens/api-base-url.token';

@Injectable({ providedIn: 'root' })
export class CreaturesService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  getMyCreatures(): Observable<MyCreaturesResponse> {
    return this.http.get<MyCreaturesResponse>(`${this.apiBaseUrl}/creatures/my`);
  }

  updateCreatureMoves(
    creatureId: string,
    moveIds: string[],
  ): Observable<UpdateCreatureMovesResponse> {
    return this.http.patch<UpdateCreatureMovesResponse>(
      `${this.apiBaseUrl}/creatures/${creatureId}/moves`,
      { moveIds },
    );
  }

  resolvePendingMove(
    creatureId: string,
    pendingMoveId: string,
    payload: { replaceMoveId?: string; skip?: boolean },
  ): Observable<ResolvePendingMoveResponse> {
    return this.http.post<ResolvePendingMoveResponse>(
      `${this.apiBaseUrl}/creatures/${creatureId}/pending-moves/${pendingMoveId}/resolve`,
      payload,
    );
  }
}

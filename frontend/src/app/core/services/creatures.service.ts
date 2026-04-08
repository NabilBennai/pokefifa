import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { MyCreaturesResponse, UpdateCreatureMovesResponse } from '../models/creature.models';
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
}

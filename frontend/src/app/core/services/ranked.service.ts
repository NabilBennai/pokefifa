import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ClaimSeasonRewardResponse, RankedOverviewResponse } from '../models/ranked.models';
import { API_BASE_URL } from '../tokens/api-base-url.token';

@Injectable({ providedIn: 'root' })
export class RankedService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  getOverview(): Observable<RankedOverviewResponse> {
    return this.http.get<RankedOverviewResponse>(`${this.apiBaseUrl}/ranked/overview`);
  }

  claimSeasonReward(): Observable<ClaimSeasonRewardResponse> {
    return this.http.post<ClaimSeasonRewardResponse>(`${this.apiBaseUrl}/ranked/season/claim`, {});
  }
}

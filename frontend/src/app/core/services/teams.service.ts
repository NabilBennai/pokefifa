import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../tokens/api-base-url.token';
import { SaveTeamPayload, Team, TeamsResponse } from '../models/team.models';

@Injectable({ providedIn: 'root' })
export class TeamsService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  getMyTeams(): Observable<TeamsResponse> {
    return this.http.get<TeamsResponse>(`${this.apiBaseUrl}/teams`);
  }

  createTeam(payload: SaveTeamPayload & { name: string }): Observable<Team> {
    return this.http.post<Team>(`${this.apiBaseUrl}/teams`, payload);
  }

  updateTeam(teamId: string, payload: SaveTeamPayload): Observable<Team> {
    return this.http.patch<Team>(`${this.apiBaseUrl}/teams/${teamId}`, payload);
  }
}

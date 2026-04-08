import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  MyPacksResponse,
  OpenPackResponse,
  PackHistoryResponse,
  PurchasePackResponse,
  StorePacksResponse,
} from '../models/pack.models';
import { API_BASE_URL } from '../tokens/api-base-url.token';

@Injectable({ providedIn: 'root' })
export class PacksService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  getMyPacks(): Observable<MyPacksResponse> {
    return this.http.get<MyPacksResponse>(`${this.apiBaseUrl}/packs/my`);
  }

  openPack(userPackId: string): Observable<OpenPackResponse> {
    return this.http.post<OpenPackResponse>(`${this.apiBaseUrl}/packs/${userPackId}/open`, {});
  }

  getHistory(limit = 10): Observable<PackHistoryResponse> {
    return this.http.get<PackHistoryResponse>(`${this.apiBaseUrl}/packs/history?limit=${limit}`);
  }

  getStore(): Observable<StorePacksResponse> {
    return this.http.get<StorePacksResponse>(`${this.apiBaseUrl}/packs/store`);
  }

  purchasePack(
    packDefinitionId: string,
    currencyType?: 'COINS' | 'GEMS' | 'SHARDS',
  ): Observable<PurchasePackResponse> {
    return this.http.post<PurchasePackResponse>(
      `${this.apiBaseUrl}/packs/purchase/${packDefinitionId}`,
      currencyType ? { currencyType } : {},
    );
  }
}

import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  InventoryCreaturesResponse,
  InventoryItemsResponse,
  InventoryOverviewResponse,
} from '../models/inventory.models';
import { API_BASE_URL } from '../tokens/api-base-url.token';

@Injectable({ providedIn: 'root' })
export class InventoryService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  getOverview(): Observable<InventoryOverviewResponse> {
    return this.http.get<InventoryOverviewResponse>(`${this.apiBaseUrl}/inventory`);
  }

  getItems(): Observable<InventoryItemsResponse> {
    return this.http.get<InventoryItemsResponse>(`${this.apiBaseUrl}/inventory/items`);
  }

  getCreatures(): Observable<InventoryCreaturesResponse> {
    return this.http.get<InventoryCreaturesResponse>(`${this.apiBaseUrl}/inventory/creatures`);
  }
}

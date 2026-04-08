import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import {
  InventoryItemsResponse,
  InventoryOverviewResponse,
} from '../../core/models/inventory.models';
import { InventoryService } from '../../core/services/inventory.service';

@Component({
  selector: 'app-inventory-page',
  templateUrl: './inventory.page.html',
})
export class InventoryPageComponent {
  private readonly inventoryService = inject(InventoryService);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly overview = signal<InventoryOverviewResponse | null>(null);
  protected readonly items = signal<InventoryItemsResponse['items']>([]);

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

    this.inventoryService.getOverview().subscribe({
      next: (response) => {
        this.overview.set(response);
        done();
      },
      error: (error: HttpErrorResponse) => {
        this.error.set(error.error?.message ?? 'Could not load inventory overview.');
        done();
      },
    });

    this.inventoryService.getItems().subscribe({
      next: (response) => {
        this.items.set(response.items);
        done();
      },
      error: () => done(),
    });
  }
}

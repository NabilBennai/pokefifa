import { MyCreatureItem } from './creature.models';

export type InventoryOverviewResponse = {
  currencies: {
    coins: number;
    gems: number;
    shards: number;
  };
  progression: {
    rating: number;
    level: number;
    xp: number;
  };
  totals: {
    creatures: number;
    items: number;
    unopenedPacks: number;
  };
};

export type InventoryItemsResponse = {
  total: number;
  items: Array<{
    id: string;
    itemId: string;
    quantity: number;
    item: {
      id: string;
      slug: string;
      name: string;
      type: 'ITEM' | 'TM' | 'EVO_MATERIAL' | 'PACK' | 'CURRENCY';
      description: string | null;
    };
  }>;
};

export type InventoryCreaturesResponse = {
  total: number;
  creatures: MyCreatureItem[];
};

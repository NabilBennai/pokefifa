export type UserPackListItem = {
  id: string;
  packDefinition: {
    slug: string;
    name: string;
    type: 'BRONZE' | 'SILVER' | 'ELITE' | 'EVENT';
  };
  createdAt: string;
};

export type MyPacksResponse = {
  totalUnopened: number;
  packs: UserPackListItem[];
};

export type PackOpenReward = {
  id: string;
  rewardType: 'CREATURE' | 'ITEM' | string;
  quantity: number;
  species?: {
    id: string;
    slug: string;
    name: string;
    rarity: 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY' | 'MYTHIC';
    primaryType: string;
    secondaryType: string | null;
    baseHp: number;
    baseAttack: number;
    baseDefense: number;
    baseSpAttack: number;
    baseSpDefense: number;
    baseSpeed: number;
  } | null;
  item?: {
    id: string;
    slug: string;
    name: string;
  } | null;
};

export type OpenPackResponse = {
  userPackId: string;
  pack: {
    id: string;
    slug: string;
    name: string;
    type: 'BRONZE' | 'SILVER' | 'ELITE' | 'EVENT';
  };
  openedAt: string;
  rewards: PackOpenReward[];
};

export type PackHistoryItem = {
  id: string;
  openedAt: string;
  packDefinition: {
    id: string;
    slug: string;
    name: string;
    type: 'BRONZE' | 'SILVER' | 'ELITE' | 'EVENT';
  };
  rewards: PackOpenReward[];
};

export type PackHistoryResponse = {
  totalOpened: number;
  history: PackHistoryItem[];
};

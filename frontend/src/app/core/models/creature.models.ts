export type MyCreatureItem = {
  id: string;
  nickname: string | null;
  level: number;
  xp: number;
  isFavorite: boolean;
  isLocked: boolean;
  createdAt: string;
  species: {
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
  };
};

export type MyCreaturesResponse = {
  totalCreatures: number;
  creatures: MyCreatureItem[];
};

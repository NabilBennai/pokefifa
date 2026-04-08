export type AiBattleResponse = {
  battleId: string;
  result: 'WIN' | 'LOSS' | 'DRAW';
  rewards: {
    coins: number;
    xp: number;
  };
  ratingDelta: number;
  team: {
    id: string;
    name: string;
    power: number;
  };
  opponent: {
    name: string;
    power?: number;
    rating?: number;
  };
  createdAt: string;
};

export type BattleHistoryItem = {
  id: string;
  mode: 'CASUAL' | 'RANKED' | 'AI';
  resultForA: 'WIN' | 'LOSS' | 'DRAW' | null;
  playerARatingBefore: number | null;
  playerARatingAfter: number | null;
  coinsAwardedA: number;
  createdAt: string;
  playerATeam: {
    id: string;
    name: string;
  };
};

export type BattleHistoryResponse = {
  total: number;
  battles: BattleHistoryItem[];
};

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
  participants?: {
    player: {
      name: string;
      slug: string | null;
    };
    opponent: {
      name: string;
      slug: string | null;
    };
  };
  gameEnded?: boolean;
  winnerSide?: 'A' | 'B' | 'DRAW';
  turns?: number;
  battleLog?: string[];
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

export type LiveBattleState = {
  battleId: string;
  mode: 'LIVE';
  queue: 'AI' | 'RANKED';
  status: 'IN_PROGRESS' | 'FINISHED';
  turn: number;
  finished: boolean;
  winnerSide: 'A' | 'B' | 'DRAW' | null;
  result: 'WIN' | 'LOSS' | 'DRAW' | null;
  rewards: {
    coins: number;
    xp: number;
  } | null;
  ratingDelta: number | null;
  player: {
    name: string;
    slug: string;
    hp: number;
    maxHp: number;
    hpPercent: number;
    moves: Array<{
      name: string;
      type: string;
      power: number;
      accuracy: number;
    }>;
    teamRemaining: number;
  } | null;
  opponent: {
    name: string;
    slug: string;
    hp: number;
    maxHp: number;
    hpPercent: number;
    teamRemaining: number;
  } | null;
  log: string[];
  latestMessage: string | null;
};

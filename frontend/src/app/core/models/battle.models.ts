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
  mustPlayerSwitch: boolean;
  winnerSide: 'A' | 'B' | 'DRAW' | null;
  result: 'WIN' | 'LOSS' | 'DRAW' | null;
  rewards: {
    coins: number;
    xp: number;
  } | null;
  ratingDelta: number | null;
  itemUsage: {
    totalUsed: number;
    totalLimit: number;
    healUsed: number;
    healLimit: number;
    reviveUsed: number;
    reviveLimit: number;
    boostUsed: number;
    boostLimit: number;
  };
  availableItems: Array<{
    slug: string;
    name: string;
    description: string | null;
    quantity: number;
    category: 'HEAL' | 'REVIVE' | 'BOOST' | 'STATUS';
    effect:
      | {
          category: 'HEAL';
          amount: number | null;
          fullRestore: boolean;
        }
      | {
          category: 'REVIVE';
          reviveRatio: number;
        }
      | {
          category: 'BOOST';
          stat: 'attack' | 'defense' | 'speed';
          stages: number;
        }
      | {
          category: 'STATUS';
          kind: 'CURE_STATUS';
        };
  }>;
  player: {
    name: string;
    slug: string;
    hp: number;
    maxHp: number;
    hpPercent: number;
    statusCondition: 'BURN' | 'POISON' | null;
    moves: Array<{
      slug: string;
      name: string;
      type: string;
      power: number | null;
      accuracy: number;
    }>;
    teamRemaining: number;
  } | null;
  playerRoster: Array<{
    index: number;
    name: string;
    slug: string;
    hp: number;
    maxHp: number;
    statusCondition: 'BURN' | 'POISON' | null;
    isActive: boolean;
    isFainted: boolean;
    canSwitch: boolean;
  }>;
  opponent: {
    name: string;
    slug: string;
    hp: number;
    maxHp: number;
    hpPercent: number;
    statusCondition: 'BURN' | 'POISON' | null;
    teamRemaining: number;
  } | null;
  log: string[];
  latestMessage: string | null;
};

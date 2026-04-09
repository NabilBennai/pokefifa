export type PvpQueueJoinedEvent = {
  teamId: string;
  joinedAt: number;
  queueSize: number;
};

export type PvpQueueLeftEvent = {
  queueSize: number;
};

export type PvpQueueStatusEvent = {
  inQueue: boolean;
  joinedAt: number | null;
  teamId: string | null;
  queueSize: number;
  matchId: string | null;
};

export type PvpQueueReadyEvent = {
  userId: string;
  username: string;
  rating: number;
};

export type PvpMatchFoundEvent = {
  matchId: string;
  mode: 'RANKED';
  teamId: string;
  opponent: {
    userId: string;
    username: string;
    rating: number;
  };
  matchedAt: string;
};

export type PvpMatchResumeEvent = {
  matchId: string;
};

export type PvpQueueErrorEvent = {
  message: string;
};

export type PvpBattleState = {
  matchId: string;
  battleId: string;
  mode: 'LIVE';
  queue: 'RANKED';
  status: 'IN_PROGRESS' | 'FINISHED';
  turn: number;
  turnExpiresAt: number | null;
  finished: boolean;
  mustPlayerSwitch: boolean;
  winnerSide: 'A' | 'B' | 'DRAW' | null;
  result: 'WIN' | 'LOSS' | 'DRAW' | null;
  rewards: { coins: number; xp: number } | null;
  ratingDelta: number | null;
  canAct: boolean;
  awaiting: 'YOU' | 'OPPONENT';
  opponentConnected: boolean;
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
  latestMessage: string | null;
  log: string[];
};

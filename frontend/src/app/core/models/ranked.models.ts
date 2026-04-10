export type DivisionCode = 'BRONZE' | 'SILVER' | 'GOLD' | 'DIAMOND' | 'MASTER';

export type RankedOverviewResponse = {
  season: {
    id: string;
    startsAt: string;
    endsAt: string;
    isActive: boolean;
    hasEnded: boolean;
    remainingMs: number;
  };
  ladder: {
    rating: number;
    division: {
      code: DivisionCode;
      label: string;
      minRating: number;
      reward: {
        coins: number;
        gems: number;
        shards: number;
        packs: number;
      };
    };
    nextDivision: {
      code: DivisionCode;
      label: string;
      minRating: number;
      reward: {
        coins: number;
        gems: number;
        shards: number;
        packs: number;
      };
    } | null;
  };
  reward: {
    canClaim: boolean;
    alreadyClaimed: boolean;
    preview: {
      coins: number;
      gems: number;
      shards: number;
      packs: number;
    };
  };
};

export type ClaimSeasonRewardResponse = {
  seasonId: string;
  division: {
    code: DivisionCode;
    label: string;
  };
  rewards: {
    coins: number;
    gems: number;
    shards: number;
    packs: number;
  };
};

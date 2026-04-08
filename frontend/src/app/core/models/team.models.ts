import { MyCreatureItem } from './creature.models';

export type TeamSlot = {
  id: string;
  slot: number;
  userCreatureId: string;
  userCreature: MyCreatureItem;
};

export type Team = {
  id: string;
  userId: string;
  name: string;
  status: 'ACTIVE' | 'ARCHIVED';
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  slots: TeamSlot[];
};

export type TeamsResponse = {
  total: number;
  teams: Team[];
};

export type SaveTeamPayload = {
  name?: string;
  status?: 'ACTIVE' | 'ARCHIVED';
  isDefault?: boolean;
  creatureIds?: string[];
};

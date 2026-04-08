export type UserRole = 'USER' | 'ADMIN';

export type AuthUser = {
  id: string;
  email: string;
  username: string;
  role: UserRole;
  coins: number;
  gems: number;
  shards: number;
  rating: number;
  level: number;
  xp: number;
  createdAt: string;
  updatedAt: string;
};

export type AuthResponse = {
  accessToken: string;
  user: AuthUser;
  starterPacksGranted?: number;
};

export type LoginPayload = {
  email: string;
  password: string;
};

export type RegisterPayload = {
  email: string;
  username: string;
  password: string;
};

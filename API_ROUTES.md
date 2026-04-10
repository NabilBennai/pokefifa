# API Routes

Base URL (local): `http://localhost:3000`

Auth header for protected routes:

```http
Authorization: Bearer <jwt>
```

## Public Routes

### Health

- `GET /`

### Auth

- `POST /auth/register`
  - body: `{ "email": string, "username": string, "password": string }`
- `POST /auth/login`
  - body: `{ "email": string, "password": string }`

### Species

- `GET /species`
- `GET /species/:id`
  - supports species `id` or `slug`

### Ranked Admin

- `POST /ranked/season/reset`
  - header: `x-admin-key: <RANKED_ADMIN_KEY>`
  - body: `{ "nextSeasonId"?: string, "force"?: boolean }`

## Protected Routes

### Auth

- `GET /auth/me`

### Creatures

- `GET /creatures/my`
- `PATCH /creatures/:id/moves`
  - body: `{ "moveIds": string[] }`
  - constraints: 1..4 move IDs

### Teams

- `GET /teams`
- `POST /teams`
  - body:
    - `name: string` (2..40)
    - `isDefault?: boolean`
    - `status?: "ACTIVE" | "ARCHIVED"`
    - `creatureIds?: string[]` (max 6, unique)
- `PATCH /teams/:id`
  - same body shape as create, all optional

### Inventory

- `GET /inventory`
- `GET /inventory/creatures`
- `GET /inventory/items`

### Packs

- `GET /packs/store`
- `GET /packs/my`
- `GET /packs/history?limit=10`
- `POST /packs/purchase/:packDefinitionId`
  - body: `{ "currencyType"?: "COINS" | "GEMS" | "SHARDS" }`
- `POST /packs/:id/open`

### Battles

- `POST /battles/ai`
  - body: `{ "teamId"?: string }`
- `POST /battles/ranked`
  - body: `{ "teamId"?: string }`
- `GET /battles/history/me`

### Live Battles (HTTP)

- `POST /battles/live/start`
  - body: `{ "teamId"?: string }`
- `POST /battles/live/ranked/start`
  - body: `{ "teamId"?: string }`
- `GET /battles/live/:id`
- `POST /battles/live/:id/action`
  - body:
    - `{ "action": "MOVE", "moveIndex": number }`
    - or `{ "action": "SWITCH", "switchIndex": number }`

### Ranked (Player)

- `GET /ranked/overview`
- `POST /ranked/season/claim`

## WebSocket PvP Gateway

Namespace: `/pvp`

Auth:

- either `handshake.auth.token`
- or `Authorization: Bearer <jwt>` in headers

Main client events:

- `queue:join` body: `{ teamId?: string }`
- `queue:leave`
- `queue:status`
- `match:join` body: `{ matchId?: string }`
- `battle:action` body:
  - `{ matchId?: string, action: "MOVE", moveIndex: number }`
  - `{ matchId?: string, action: "SWITCH", switchIndex: number }`

Main server events:

- `queue:ready`
- `queue:joined`
- `queue:left`
- `queue:error`
- `match:found`
- `match:state`
- `match:resume`
- `battle:error`

## Notes

- Most player routes return `null` or empty arrays when user context is missing, but clients should treat protected routes as requiring valid JWT.
- DTO validation is strict (`whitelist + forbidNonWhitelisted`).

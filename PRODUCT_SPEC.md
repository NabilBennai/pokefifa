# PokeUT Product Specification

## 1. Product Goal

PokeUT is a competitive collection game with a fast, repeatable loop:

1. Build a squad
2. Fight battles
3. Earn rewards
4. Open packs
5. Improve squad quality
6. Push ranked progression

The product combines:

- collection depth
- tactical team building
- short competitive sessions
- long-term account progression

## 2. Platforms and Architecture

- Frontend: Angular SPA
- Backend: NestJS REST API + Socket.IO PvP gateway
- Database: PostgreSQL via Prisma
- Auth: JWT
- Localization: EN / FR / ES

## 3. Core Domain Model

### Player

- account identity: email, username
- progression: level, xp, rating
- currencies: coins, gems, shards

### Creature

- species-driven stats and typing
- rarity tiers: COMMON, RARE, EPIC, LEGENDARY, MYTHIC
- owned instance supports level/xp and learned moves

### Team

- max 6 creatures
- no duplicate owned creature instance in same team
- one optional default team per player

### Inventory and Packs

- inventory stores items and quantities
- unopened packs can be purchased/claimed
- opening a pack generates rewards and records reward history

Default pack opening behavior (current config):

- `PACK_OPEN_CREATURE_REWARDS=5`
- `PACK_OPEN_ITEM_REWARDS=1`

## 4. Gameplay Systems

### 4.1 Pack Economy

- pack purchase from store using COINS or GEMS (pack-dependent)
- weighted drops for creatures and items
- server-side transactional opening
- frontend supports:
  - open single pack
  - open all unopened packs with one final aggregated result view

### 4.2 PvE and Ranked (HTTP)

- AI battle endpoint for quick progression
- ranked battle endpoint for rating loop
- battle history endpoint for recent logs/results
- live ranked and live casual battle start/action endpoints

### 4.3 Real-time Ranked PvP (WebSocket)

Namespace: `/pvp`

- queue join/leave/status
- matchmaking by rating tolerance
- live turn-based action stream
- disconnect timeout and forfeit handling
- rating and reward settlement at match end

## 5. Ranked and Season System

- ranked overview endpoint returns division context and season state
- season reward claim endpoint grants configured rewards once per season
- admin season reset endpoint (`x-admin-key`) supports controlled resets

## 6. Security and Validation

- passwords hashed before storage
- JWT guard protects player-specific resources
- DTO validation with whitelist and forbidden unknown properties
- CORS allowlist with optional Vercel preview-domain support

## 7. Non-Functional Requirements

### Performance

- interactive APIs should remain responsive under normal gameplay load
- pack opening and reward writes must remain atomic and consistent

### Reliability

- transactional integrity for purchases and openings
- deterministic guards for already-opened packs and insufficient balance

### Scalability

- split frontend/backend services
- PostgreSQL-backed persistence and indexed lookup fields
- PvP queue/match state structured for later externalization

## 8. MVP Scope (Implemented)

- authentication (register/login/me)
- species listing
- creature inventory and move editing
- team creation and updates
- store + purchases
- pack opening + history + open-all UX
- inventory overview
- AI and ranked battle APIs
- ranked season overview and claim
- real-time ranked queue and PvP match flow

## 9. Out of Scope (Current)

- direct player-to-player trading
- guilds/clans
- marketplace auction mechanics
- tournament brackets
- anti-cheat and advanced moderation tooling

## 10. Success Metrics

Track at minimum:

- daily active players
- battle sessions per active player
- packs opened per active player
- conversion from purchased pack to opened pack
- 7-day and 30-day retention
- ranked participation rate

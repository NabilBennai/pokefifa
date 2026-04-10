# MVP Roadmap

This roadmap reflects the current state of the repository.

## Status Legend

- DONE: implemented and in active code paths
- IN PROGRESS: partially implemented, still evolving
- NEXT: planned after MVP hardening

## Phase 1 - Foundation (DONE)

- User authentication (register/login/me)
- Prisma schema and migrations
- Core entities: users, species, creatures, teams, inventory, packs, battles, ranked
- Local dev infra via Docker (PostgreSQL + MailDev)

## Phase 2 - Collection and Economy (DONE)

- Species catalog API
- Inventory overview and lists
- Store pack listing
- Pack purchasing transaction flow
- Pack opening with persisted rewards history
- Frontend packs UX:
  - open one pack
  - open all unopened packs and show aggregated final rewards

## Phase 3 - Team and Creature Management (DONE)

- Team creation/update with server-side validation
- Default team behavior
- Creature list and move set update endpoint
- Frontend squad builder and move editor screens

## Phase 4 - Battle Loops (DONE)

- AI battle endpoint
- Ranked battle endpoint
- Battle history endpoint
- Live battle HTTP flow (start/get state/play action)

## Phase 5 - Ranked and Seasons (DONE)

- Ranked overview endpoint
- Season reward claim endpoint
- Admin season reset endpoint (`x-admin-key`)
- Frontend ranked page with reward claim UX

## Phase 6 - Real-time PvP (IN PROGRESS)

- Socket.IO `/pvp` gateway with queue and matchmaking
- Live turn handling and reconnect/forfeit safeguards
- Result settlement with rating and rewards
- Ongoing hardening targets:
  - deeper observability and metrics
  - stronger anti-abuse controls
  - scale testing under concurrent queue load

## Phase 7 - Quality and Delivery (DONE for MVP scope)

- Monorepo CI workflow with selective frontend/backend jobs
- Frontend checks: format/lint/i18n/tests/build
- Backend checks: migrations/lint/tests/e2e/build

## Next Priorities (NEXT)

1. Balance and economy tuning
   - Drop tables and reward pacing by pack tier
   - Ranked reward calibration
2. LiveOps and admin tooling
   - safer admin endpoints and audit logs
   - season management UX
3. Player-facing depth
   - richer battle logs and replay UX
   - additional progression hooks and events
4. Deployment ergonomics
   - optional CD reintroduction with secret-safe workflows
   - environment promotion strategy (dev/stage/prod)

# PokeUT

A full-stack competitive creature team-builder inspired by Ultimate Team loops.

Players collect creatures, build squads of 6, fight AI and ranked battles, open packs, and progress through seasonal rewards.

## Current Product Snapshot

- Frontend: Angular 21 (standalone components, Tailwind v4, i18n EN/FR/ES)
- Backend: NestJS 11 + Prisma + PostgreSQL
- Auth: JWT (register, login, protected routes)
- Pack flow: single open and "open all packs" UX
- Pack rewards default: 5 creature rewards + 1 item reward per pack
- Real-time PvP: Socket.IO namespace `/pvp` with ranked queue and live match state
- CI: GitHub Actions monorepo workflow (`.github/workflows/ci.yml`)

## Monorepo Structure

```text
pokefifa/
  backend/      NestJS API, Prisma schema/migrations, server logic
  frontend/     Angular app, pages/components/services, i18n JSON
  .github/      CI workflow
  docker-compose.dev.yml  Postgres + MailDev for local dev
```

## Local Setup

### Prerequisites

- Node.js 22+
- npm 10+
- Docker (recommended for local PostgreSQL and MailDev)

### 1. Clone

```bash
git clone <your-repo-url>
cd pokefifa
```

### 2. Start local infra

```bash
docker compose -f docker-compose.dev.yml up -d
```

This starts:

- PostgreSQL on `localhost:5432`
- MailDev SMTP on `localhost:1025`
- MailDev UI on `http://localhost:1080`

### 3. Configure backend env

```bash
cd backend
cp .env.example .env
```

Important defaults in `.env.example`:

- `DATABASE_URL=postgresql://pokefifa:pokefifa@localhost:5432/pokefifa`
- `PACK_OPEN_CREATURE_REWARDS=5`
- `PACK_OPEN_ITEM_REWARDS=1`
- `SWAGGER_ENABLED=false`
- `SWAGGER_PATH=internal/docs-admin-reference`

### 4. Install and run backend

```bash
cd backend
npm ci
npm run prisma:migrate:deploy
npm run start:dev
```

Backend runs on `http://localhost:3000`.

### 5. Install and run frontend

```bash
cd frontend
npm ci
npm run start
```

Frontend runs on `http://localhost:4200`.

## Useful Scripts

### Backend (`backend/package.json`)

- `npm run start:dev` - run API in watch mode
- `npm run build` - production build
- `npm run lint` - ESLint
- `npm run test` - unit tests
- `npm run test:e2e` - e2e tests
- `npm run prisma:migrate:deploy` - apply migrations

### Frontend (`frontend/package.json`)

- `npm run start` - Angular dev server
- `npm run build` - production build
- `npm run lint` - ESLint
- `npm run test -- --watch=false` - unit tests
- `npm run i18n:check` - checks locale key consistency and hardcoded text

## Gameplay Features Implemented

- Account creation and login
- Creature collection and move-set editing
- Team creation/update with validation (max 6, unique creatures)
- Store purchase flow (coins/gems)
- Pack opening history
- Open one pack and open all packs flows
- AI battles
- Ranked battles (sync + live)
- Ranked season overview and reward claim
- Inventory overview (creatures, items, currencies, unopened packs)

## API and Contracts

- Full REST endpoint list: [`API_ROUTES.md`](./API_ROUTES.md)
- Product-level rules and scope: [`PRODUCT_SPEC.md`](./PRODUCT_SPEC.md)
- Delivery plan/status: [`MVP_ROADMAP.md`](./MVP_ROADMAP.md)

## CI

The repository uses one CI workflow:

- File: `.github/workflows/ci.yml`
- Trigger: pull requests + pushes to `main`
- Behavior:
  - Detects changed area (frontend/backend)
  - Runs only relevant jobs
  - Frontend: format check, lint, i18n check, tests, build
  - Backend: PostgreSQL service, migrations, format check, lint, unit/e2e tests, build

## Deployment Notes

- Frontend and backend include `vercel.json` configs.
- No automated CD workflow is currently present in `.github/workflows`.
- You can deploy manually using Vercel CLI or Vercel Git integration.

## Private Swagger (Admin Only)

Swagger is intentionally hidden and disabled by default.

- Enable by setting `SWAGGER_ENABLED=true` in backend env
- Access URL: `/<SWAGGER_PATH>` (default: `/internal/docs-admin-reference`)
- Access control: HTTP Basic Auth credentials must match an existing user with role `ADMIN`
  - username: admin email
  - password: admin account password

## License

This project is for educational and development use.

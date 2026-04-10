# Pokefifa

Pokefifa is a competitive team-building game inspired by collectible squad modes such as Ultimate Team. Instead of football players, users build teams of Pokémon-like creatures, battle other teams, earn coins, and open packs containing creatures, items, and TMs.

The project is designed as a modern full-stack web application using:

* **PostgreSQL** – relational database
* **NestJS** – backend API
* **Angular** – frontend application
* **Vercel** – deployment platform

---

# Table of Contents

* Overview
* Tech Stack
* Architecture
* Project Structure
* Setup
* Environment Variables
* Database
* Running Locally
* Deployment
* Game Concepts

---

# Overview

Pokefifa is a collection and strategy game where players:

1. Build a squad of creatures
2. Battle other squads
3. Earn coins and rewards
4. Open packs to obtain new creatures, TMs, and items
5. Improve their team and climb ranked divisions

Core features:

* Team builder
* Ranked battles
* Pack opening system
* Inventory management
* Economy system
* Progression and rewards

---

# Tech Stack

## Backend

* NestJS
* TypeScript
* PostgreSQL
* Prisma ORM (recommended)
* JWT authentication

## Frontend

* Angular
* TypeScript
* RxJS
* Angular Router
* Angular Material or Tailwind

## Infrastructure

* Vercel hosting
* PostgreSQL (Neon / Supabase / Railway recommended)
* Redis (optional later for matchmaking and caching)

---

# Architecture

Client–server architecture.

```
Angular Frontend
       │
       │ REST / JSON API
       ▼
NestJS Backend
       │
       │ ORM
       ▼
PostgreSQL Database
```

Backend responsibilities:

* Authentication
* Game logic
* Battle resolution
* Pack generation
* Economy rules
* Database management

Frontend responsibilities:

* UI
* Team builder
* Pack opening animations
* Battle interface
* Inventory management

---

# Project Structure

```
pokefifa/
│
├── backend/
│   ├── src/
│   │   ├── auth/
│   │   ├── users/
│   │   ├── creatures/
│   │   ├── teams/
│   │   ├── battles/
│   │   ├── packs/
│   │   ├── inventory/
│   │   └── economy/
│   │
│   ├── prisma/
│   │   └── schema.prisma
│   │
│   └── main.ts
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── pages/
│   │   │   ├── components/
│   │   │   ├── services/
│   │   │   └── models/
│   │   │
│   │   └── environments/
│
└── README.md
```

---

# Setup

## Requirements

* Node.js 18+
* PostgreSQL
* npm or pnpm

---

# Clone the Repository

```
git clone https://github.com/yourname/pokefifa
cd pokefifa
```

---

# Backend Installation

```
cd backend
npm install
```

Run development server:

```
npm run start:dev
```

---

# Frontend Installation

```
cd frontend
npm install
```

Run Angular dev server:

```
ng serve
```

Application will be available at:

```
http://localhost:4200
```

---

# Environment Variables

Create `.env` in the backend folder.

Example:

```
DATABASE_URL=postgresql://user:password@localhost:5432/pokefifa

JWT_SECRET=supersecret

PORT=3000
```

---

# Database

Using **PostgreSQL** with an ORM (Prisma recommended).

Example main entities:

* Users
* Creatures
* Teams
* Inventory
* Packs
* Items
* TMs
* Battles

Run migrations:

```
npx prisma migrate dev
```

Generate Prisma client:

```
npx prisma generate
```

---

# Deployment

Recommended setup:

Frontend:

* Deploy Angular build to **Vercel**

Backend:

* Deploy NestJS API as serverless functions or on a Node hosting service.

Database:

* Neon
* Supabase
* Railway

---

# Game Concepts

## Squad System

Players build a team of **6 creatures**.

Each creature has:

* Type
* Stats
* Moves
* Ability
* Item slot
* Rarity

---

## Packs

Players can buy packs using coins earned in battles.

Pack types:

* Bronze Pack
* Silver Pack
* Elite Pack
* Event Packs

Each pack contains random rewards:

* Creatures
* TMs
* Items
* Currency

---

## Battles

Players fight using their team.

Rewards include:

* Coins
* XP
* Seasonal rewards

---

## Economy

Currency types:

* Coins (earned)
* Premium currency (optional)
* Shards (from duplicates)

---

# Future Features

* Draft mode
* Seasonal ladders
* Special events
* Creature evolutions
* Guilds / clubs
* Trading system

---

# License

This project is for educational and development purposes.

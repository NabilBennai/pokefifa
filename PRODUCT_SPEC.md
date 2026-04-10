# Pokefifa Product Specification

## Vision

Pokefifa is a competitive creature-collection game where players build teams, compete in battles, and improve their squad through pack openings and progression systems.

The goal is to create a game that combines:

* squad building
* strategy
* collecting
* progression

while maintaining fast and competitive gameplay.

---

# Core Gameplay Loop

1. Player builds a squad
2. Player battles opponents
3. Player earns coins and rewards
4. Player opens packs
5. Player improves team
6. Player climbs ranked divisions

---

# Core Systems

## 1. Creatures

Creatures represent the main collectible units.

Attributes:

* id
* name
* type
* rarity
* hp
* attack
* defense
* speed
* ability
* move slots

Rarity tiers:

* Common
* Rare
* Epic
* Legendary
* Mythic

---

## 2. Teams

Players create teams composed of **6 creatures**.

Rules:

* Maximum 6 creatures
* One creature cannot appear twice in the same team
* Team synergy bonuses may apply

---

## 3. Inventory

Inventory stores player assets.

Includes:

* creatures
* items
* TMs
* evolution materials
* currencies

---

## 4. Packs

Packs are purchased using coins.

Example pack probabilities:

Bronze Pack

* 70% common creature
* 25% rare
* 5% epic

Silver Pack

* 50% rare
* 40% epic
* 10% legendary

Elite Pack

* 60% epic
* 30% legendary
* 10% mythic

---

## 5. Economy

Currencies:

Coins
Earned from battles.

Premium currency
Optional paid currency.

Shards
Generated from duplicate creatures.

Shards can be used to craft specific creatures.

---

# Battle System

Simplified turn-based combat.

Each turn:

1. Players choose a move
2. Speed determines turn order
3. Damage calculated using stats and type modifiers

Damage formula (simplified):

```
Damage = (Attack / Defense) × MovePower × TypeModifier
```

Battles end when all creatures on one team faint.

---

# Ranked System

Players compete in divisions.

Example divisions:

* Bronze
* Silver
* Gold
* Diamond
* Master

Ranking determined by match wins.

Season resets occur periodically.

---

# User Stories

## Authentication

User Story 1
As a new player
I want to create an account
So that my progress is saved.

User Story 2
As a player
I want to log in securely
So that my account remains protected.

---

## Squad Building

User Story 3
As a player
I want to build a team of creatures
So that I can participate in battles.

User Story 4
As a player
I want to edit my team
So that I can optimize strategy.

---

## Battles

User Story 5
As a player
I want to challenge opponents
So that I can test my team.

User Story 6
As a player
I want to earn rewards from battles
So that I can improve my team.

---

## Packs

User Story 7
As a player
I want to purchase packs
So that I can obtain new creatures.

User Story 8
As a player
I want random rewards from packs
So that collecting feels exciting.

---

## Inventory

User Story 9
As a player
I want to view my inventory
So that I know what assets I own.

User Story 10
As a player
I want to apply items and TMs
So that I can strengthen my creatures.

---

# Non-Functional Requirements

Performance

* API response time < 200ms
* Battle resolution < 1 second

Scalability

* Support thousands of concurrent users

Security

* JWT authentication
* Password hashing
* Rate limiting

Reliability

* Database backups
* Transaction safety for pack openings

---

# MVP Scope

First version should include:

* authentication
* creature collection
* team builder
* basic battles
* coins
* pack opening
* inventory

Everything else can be added later.

---

# Future Systems

* creature evolutions
* trading system
* tournaments
* seasonal rewards
* guilds
* marketplace

---

# Success Metrics

Measure success by:

* daily active users
* matches played
* packs opened
* retention rate


# API Routes

Auth
POST /auth/register
POST /auth/login
GET /auth/me

Species
GET /species
GET /species/:id (supports id or slug)

Creatures
GET /creatures/my

Teams
GET /teams
POST /teams
PATCH /teams/:id

Inventory
GET /inventory
GET /inventory/creatures
GET /inventory/items

Packs
GET /packs/store
GET /packs/my
GET /packs/history?limit=10
POST /packs/purchase/:packDefinitionId
POST /packs/:id/open

Battles
POST /battles/ai
POST /battles/ranked
GET /battles/history/me

Ranked
GET /ranked/overview
POST /ranked/season/claim
POST /ranked/season/reset (x-admin-key header)

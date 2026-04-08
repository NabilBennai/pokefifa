
# API Routes

Auth
POST /auth/register
POST /auth/login
GET /users/me

Species
GET /species
GET /species/:id

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
POST /packs/purchase/:packDefinitionId
POST /packs/open/:userPackId

Battles
POST /battles/ai
GET /battles/history/me

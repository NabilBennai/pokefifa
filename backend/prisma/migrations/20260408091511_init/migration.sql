-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "BattleMode" AS ENUM ('CASUAL', 'RANKED', 'AI');

-- CreateEnum
CREATE TYPE "BattleResult" AS ENUM ('WIN', 'LOSS', 'DRAW');

-- CreateEnum
CREATE TYPE "TeamStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CreatureRarity" AS ENUM ('COMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHIC');

-- CreateEnum
CREATE TYPE "InventoryItemType" AS ENUM ('ITEM', 'TM', 'EVO_MATERIAL', 'PACK', 'CURRENCY');

-- CreateEnum
CREATE TYPE "PackType" AS ENUM ('BRONZE', 'SILVER', 'ELITE', 'EVENT');

-- CreateEnum
CREATE TYPE "PackSource" AS ENUM ('SHOP', 'REWARD', 'GIFT', 'ADMIN');

-- CreateEnum
CREATE TYPE "CurrencyType" AS ENUM ('COINS', 'GEMS', 'SHARDS');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('BATTLE_REWARD', 'PACK_PURCHASE', 'PACK_OPEN', 'QUEST_REWARD', 'ADMIN_GRANT', 'DUPLICATE_CONVERT', 'CRAFT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "coins" INTEGER NOT NULL DEFAULT 0,
    "gems" INTEGER NOT NULL DEFAULT 0,
    "shards" INTEGER NOT NULL DEFAULT 0,
    "rating" INTEGER NOT NULL DEFAULT 1000,
    "level" INTEGER NOT NULL DEFAULT 1,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatureSpecies" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rarity" "CreatureRarity" NOT NULL,
    "primaryType" TEXT NOT NULL,
    "secondaryType" TEXT,
    "baseHp" INTEGER NOT NULL,
    "baseAttack" INTEGER NOT NULL,
    "baseDefense" INTEGER NOT NULL,
    "baseSpAttack" INTEGER NOT NULL,
    "baseSpDefense" INTEGER NOT NULL,
    "baseSpeed" INTEGER NOT NULL,
    "abilityName" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreatureSpecies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Move" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "power" INTEGER,
    "accuracy" INTEGER,
    "pp" INTEGER,
    "isTmCompatible" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Move_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpeciesMove" (
    "id" TEXT NOT NULL,
    "speciesId" TEXT NOT NULL,
    "moveId" TEXT NOT NULL,
    "unlockLevel" INTEGER NOT NULL DEFAULT 1,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SpeciesMove_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserCreature" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "speciesId" TEXT NOT NULL,
    "nickname" TEXT,
    "level" INTEGER NOT NULL DEFAULT 1,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "ivHp" INTEGER NOT NULL DEFAULT 0,
    "ivAttack" INTEGER NOT NULL DEFAULT 0,
    "ivDefense" INTEGER NOT NULL DEFAULT 0,
    "ivSpAttack" INTEGER NOT NULL DEFAULT 0,
    "ivSpDefense" INTEGER NOT NULL DEFAULT 0,
    "ivSpeed" INTEGER NOT NULL DEFAULT 0,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "heldItemInstanceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserCreature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserCreatureMove" (
    "id" TEXT NOT NULL,
    "userCreatureId" TEXT NOT NULL,
    "moveId" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,

    CONSTRAINT "UserCreatureMove_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "TeamStatus" NOT NULL DEFAULT 'ACTIVE',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamSlot" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userCreatureId" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,

    CONSTRAINT "TeamSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "InventoryItemType" NOT NULL,
    "description" TEXT,
    "tmMoveId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserInventoryItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserInventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackDefinition" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PackType" NOT NULL,
    "coinPrice" INTEGER,
    "gemPrice" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PackDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackDropCreature" (
    "id" TEXT NOT NULL,
    "packDefinitionId" TEXT NOT NULL,
    "speciesId" TEXT NOT NULL,
    "weight" INTEGER NOT NULL,

    CONSTRAINT "PackDropCreature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackDropItem" (
    "id" TEXT NOT NULL,
    "packDefinitionId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantityMin" INTEGER NOT NULL DEFAULT 1,
    "quantityMax" INTEGER NOT NULL DEFAULT 1,
    "weight" INTEGER NOT NULL,

    CONSTRAINT "PackDropItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPack" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "packDefinitionId" TEXT NOT NULL,
    "source" "PackSource" NOT NULL DEFAULT 'SHOP',
    "openedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserPack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackOpeningReward" (
    "id" TEXT NOT NULL,
    "userPackId" TEXT NOT NULL,
    "rewardType" TEXT NOT NULL,
    "speciesId" TEXT,
    "itemId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "PackOpeningReward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Battle" (
    "id" TEXT NOT NULL,
    "mode" "BattleMode" NOT NULL,
    "playerAId" TEXT NOT NULL,
    "playerBId" TEXT,
    "playerATeamId" TEXT NOT NULL,
    "playerBTeamId" TEXT,
    "winnerUserId" TEXT,
    "resultForA" "BattleResult",
    "resultForB" "BattleResult",
    "playerARatingBefore" INTEGER,
    "playerARatingAfter" INTEGER,
    "playerBRatingBefore" INTEGER,
    "playerBRatingAfter" INTEGER,
    "coinsAwardedA" INTEGER NOT NULL DEFAULT 0,
    "coinsAwardedB" INTEGER NOT NULL DEFAULT 0,
    "battleLogJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "Battle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CurrencyTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currencyType" "CurrencyType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "transactionType" "TransactionType" NOT NULL,
    "referenceId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CurrencyTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_username_idx" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "CreatureSpecies_slug_key" ON "CreatureSpecies"("slug");

-- CreateIndex
CREATE INDEX "CreatureSpecies_name_idx" ON "CreatureSpecies"("name");

-- CreateIndex
CREATE INDEX "CreatureSpecies_rarity_idx" ON "CreatureSpecies"("rarity");

-- CreateIndex
CREATE INDEX "CreatureSpecies_primaryType_idx" ON "CreatureSpecies"("primaryType");

-- CreateIndex
CREATE UNIQUE INDEX "Move_slug_key" ON "Move"("slug");

-- CreateIndex
CREATE INDEX "Move_name_idx" ON "Move"("name");

-- CreateIndex
CREATE INDEX "Move_type_idx" ON "Move"("type");

-- CreateIndex
CREATE INDEX "SpeciesMove_speciesId_idx" ON "SpeciesMove"("speciesId");

-- CreateIndex
CREATE INDEX "SpeciesMove_moveId_idx" ON "SpeciesMove"("moveId");

-- CreateIndex
CREATE UNIQUE INDEX "SpeciesMove_speciesId_moveId_key" ON "SpeciesMove"("speciesId", "moveId");

-- CreateIndex
CREATE INDEX "UserCreature_userId_idx" ON "UserCreature"("userId");

-- CreateIndex
CREATE INDEX "UserCreature_speciesId_idx" ON "UserCreature"("speciesId");

-- CreateIndex
CREATE INDEX "UserCreature_userId_speciesId_idx" ON "UserCreature"("userId", "speciesId");

-- CreateIndex
CREATE INDEX "UserCreatureMove_userCreatureId_idx" ON "UserCreatureMove"("userCreatureId");

-- CreateIndex
CREATE INDEX "UserCreatureMove_moveId_idx" ON "UserCreatureMove"("moveId");

-- CreateIndex
CREATE UNIQUE INDEX "UserCreatureMove_userCreatureId_slot_key" ON "UserCreatureMove"("userCreatureId", "slot");

-- CreateIndex
CREATE INDEX "Team_userId_idx" ON "Team"("userId");

-- CreateIndex
CREATE INDEX "Team_userId_isDefault_idx" ON "Team"("userId", "isDefault");

-- CreateIndex
CREATE INDEX "TeamSlot_teamId_idx" ON "TeamSlot"("teamId");

-- CreateIndex
CREATE INDEX "TeamSlot_userCreatureId_idx" ON "TeamSlot"("userCreatureId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamSlot_teamId_slot_key" ON "TeamSlot"("teamId", "slot");

-- CreateIndex
CREATE UNIQUE INDEX "TeamSlot_teamId_userCreatureId_key" ON "TeamSlot"("teamId", "userCreatureId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_slug_key" ON "InventoryItem"("slug");

-- CreateIndex
CREATE INDEX "InventoryItem_type_idx" ON "InventoryItem"("type");

-- CreateIndex
CREATE INDEX "InventoryItem_name_idx" ON "InventoryItem"("name");

-- CreateIndex
CREATE INDEX "UserInventoryItem_userId_idx" ON "UserInventoryItem"("userId");

-- CreateIndex
CREATE INDEX "UserInventoryItem_itemId_idx" ON "UserInventoryItem"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "UserInventoryItem_userId_itemId_key" ON "UserInventoryItem"("userId", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "PackDefinition_slug_key" ON "PackDefinition"("slug");

-- CreateIndex
CREATE INDEX "PackDefinition_type_idx" ON "PackDefinition"("type");

-- CreateIndex
CREATE INDEX "PackDefinition_isActive_idx" ON "PackDefinition"("isActive");

-- CreateIndex
CREATE INDEX "PackDropCreature_packDefinitionId_idx" ON "PackDropCreature"("packDefinitionId");

-- CreateIndex
CREATE INDEX "PackDropCreature_speciesId_idx" ON "PackDropCreature"("speciesId");

-- CreateIndex
CREATE UNIQUE INDEX "PackDropCreature_packDefinitionId_speciesId_key" ON "PackDropCreature"("packDefinitionId", "speciesId");

-- CreateIndex
CREATE INDEX "PackDropItem_packDefinitionId_idx" ON "PackDropItem"("packDefinitionId");

-- CreateIndex
CREATE INDEX "PackDropItem_itemId_idx" ON "PackDropItem"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "PackDropItem_packDefinitionId_itemId_key" ON "PackDropItem"("packDefinitionId", "itemId");

-- CreateIndex
CREATE INDEX "UserPack_userId_idx" ON "UserPack"("userId");

-- CreateIndex
CREATE INDEX "UserPack_packDefinitionId_idx" ON "UserPack"("packDefinitionId");

-- CreateIndex
CREATE INDEX "UserPack_openedAt_idx" ON "UserPack"("openedAt");

-- CreateIndex
CREATE INDEX "PackOpeningReward_userPackId_idx" ON "PackOpeningReward"("userPackId");

-- CreateIndex
CREATE INDEX "PackOpeningReward_speciesId_idx" ON "PackOpeningReward"("speciesId");

-- CreateIndex
CREATE INDEX "PackOpeningReward_itemId_idx" ON "PackOpeningReward"("itemId");

-- CreateIndex
CREATE INDEX "Battle_playerAId_idx" ON "Battle"("playerAId");

-- CreateIndex
CREATE INDEX "Battle_playerBId_idx" ON "Battle"("playerBId");

-- CreateIndex
CREATE INDEX "Battle_winnerUserId_idx" ON "Battle"("winnerUserId");

-- CreateIndex
CREATE INDEX "Battle_mode_idx" ON "Battle"("mode");

-- CreateIndex
CREATE INDEX "Battle_createdAt_idx" ON "Battle"("createdAt");

-- CreateIndex
CREATE INDEX "CurrencyTransaction_userId_idx" ON "CurrencyTransaction"("userId");

-- CreateIndex
CREATE INDEX "CurrencyTransaction_currencyType_idx" ON "CurrencyTransaction"("currencyType");

-- CreateIndex
CREATE INDEX "CurrencyTransaction_transactionType_idx" ON "CurrencyTransaction"("transactionType");

-- CreateIndex
CREATE INDEX "CurrencyTransaction_createdAt_idx" ON "CurrencyTransaction"("createdAt");

-- AddForeignKey
ALTER TABLE "SpeciesMove" ADD CONSTRAINT "SpeciesMove_speciesId_fkey" FOREIGN KEY ("speciesId") REFERENCES "CreatureSpecies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeciesMove" ADD CONSTRAINT "SpeciesMove_moveId_fkey" FOREIGN KEY ("moveId") REFERENCES "Move"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCreature" ADD CONSTRAINT "UserCreature_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCreature" ADD CONSTRAINT "UserCreature_speciesId_fkey" FOREIGN KEY ("speciesId") REFERENCES "CreatureSpecies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCreatureMove" ADD CONSTRAINT "UserCreatureMove_userCreatureId_fkey" FOREIGN KEY ("userCreatureId") REFERENCES "UserCreature"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCreatureMove" ADD CONSTRAINT "UserCreatureMove_moveId_fkey" FOREIGN KEY ("moveId") REFERENCES "Move"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamSlot" ADD CONSTRAINT "TeamSlot_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamSlot" ADD CONSTRAINT "TeamSlot_userCreatureId_fkey" FOREIGN KEY ("userCreatureId") REFERENCES "UserCreature"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_tmMoveId_fkey" FOREIGN KEY ("tmMoveId") REFERENCES "Move"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserInventoryItem" ADD CONSTRAINT "UserInventoryItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserInventoryItem" ADD CONSTRAINT "UserInventoryItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackDropCreature" ADD CONSTRAINT "PackDropCreature_packDefinitionId_fkey" FOREIGN KEY ("packDefinitionId") REFERENCES "PackDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackDropCreature" ADD CONSTRAINT "PackDropCreature_speciesId_fkey" FOREIGN KEY ("speciesId") REFERENCES "CreatureSpecies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackDropItem" ADD CONSTRAINT "PackDropItem_packDefinitionId_fkey" FOREIGN KEY ("packDefinitionId") REFERENCES "PackDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackDropItem" ADD CONSTRAINT "PackDropItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPack" ADD CONSTRAINT "UserPack_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPack" ADD CONSTRAINT "UserPack_packDefinitionId_fkey" FOREIGN KEY ("packDefinitionId") REFERENCES "PackDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackOpeningReward" ADD CONSTRAINT "PackOpeningReward_userPackId_fkey" FOREIGN KEY ("userPackId") REFERENCES "UserPack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackOpeningReward" ADD CONSTRAINT "PackOpeningReward_speciesId_fkey" FOREIGN KEY ("speciesId") REFERENCES "CreatureSpecies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackOpeningReward" ADD CONSTRAINT "PackOpeningReward_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Battle" ADD CONSTRAINT "Battle_playerAId_fkey" FOREIGN KEY ("playerAId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Battle" ADD CONSTRAINT "Battle_playerBId_fkey" FOREIGN KEY ("playerBId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Battle" ADD CONSTRAINT "Battle_playerATeamId_fkey" FOREIGN KEY ("playerATeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Battle" ADD CONSTRAINT "Battle_playerBTeamId_fkey" FOREIGN KEY ("playerBTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurrencyTransaction" ADD CONSTRAINT "CurrencyTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

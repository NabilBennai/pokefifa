-- CreateTable
CREATE TABLE "public"."UserCreaturePendingMove" (
    "id" TEXT NOT NULL,
    "userCreatureId" TEXT NOT NULL,
    "moveId" TEXT NOT NULL,
    "unlockLevel" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserCreaturePendingMove_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserCreaturePendingMove_userCreatureId_moveId_key" ON "public"."UserCreaturePendingMove"("userCreatureId", "moveId");

-- CreateIndex
CREATE INDEX "UserCreaturePendingMove_userCreatureId_idx" ON "public"."UserCreaturePendingMove"("userCreatureId");

-- CreateIndex
CREATE INDEX "UserCreaturePendingMove_moveId_idx" ON "public"."UserCreaturePendingMove"("moveId");

-- AddForeignKey
ALTER TABLE "public"."UserCreaturePendingMove" ADD CONSTRAINT "UserCreaturePendingMove_userCreatureId_fkey" FOREIGN KEY ("userCreatureId") REFERENCES "public"."UserCreature"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserCreaturePendingMove" ADD CONSTRAINT "UserCreaturePendingMove_moveId_fkey" FOREIGN KEY ("moveId") REFERENCES "public"."Move"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "TaskCategory" AS ENUM ('BEFORE_MOVE', 'MOVING_DAY', 'AFTER_MOVE');

-- CreateEnum
CREATE TYPE "BudgetCategory" AS ENUM ('DEPOSIT', 'MOVERS', 'FURNITURE', 'SUPPLIES', 'OTHER');

-- CreateTable
CREATE TABLE "moves" (
    "id" TEXT NOT NULL,
    "old_address" TEXT NOT NULL,
    "new_address" TEXT NOT NULL,
    "move_date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "move_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" "TaskCategory" NOT NULL,
    "due_date" DATE,
    "is_complete" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_items" (
    "id" TEXT NOT NULL,
    "move_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" "BudgetCategory" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "is_paid" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "budget_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_lookups" (
    "id" TEXT NOT NULL,
    "zip_or_address_hash" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "providers_json" JSONB NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_lookups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tasks_move_id_idx" ON "tasks"("move_id");

-- CreateIndex
CREATE INDEX "budget_items_move_id_idx" ON "budget_items"("move_id");

-- CreateIndex
CREATE UNIQUE INDEX "provider_lookups_zip_or_address_hash_key" ON "provider_lookups"("zip_or_address_hash");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_move_id_fkey" FOREIGN KEY ("move_id") REFERENCES "moves"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_items" ADD CONSTRAINT "budget_items_move_id_fkey" FOREIGN KEY ("move_id") REFERENCES "moves"("id") ON DELETE CASCADE ON UPDATE CASCADE;

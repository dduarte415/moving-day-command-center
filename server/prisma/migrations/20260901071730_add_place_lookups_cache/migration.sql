-- CreateTable
CREATE TABLE "place_lookups" (
    "id" TEXT NOT NULL,
    "address_hash" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "places_json" JSONB NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "place_lookups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "place_lookups_address_hash_key" ON "place_lookups"("address_hash");

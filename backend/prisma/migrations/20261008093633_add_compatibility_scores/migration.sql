-- CreateTable
CREATE TABLE "compatibility_scores" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "breakdown" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compatibility_scores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "compatibility_scores_tenantId_idx" ON "compatibility_scores"("tenantId");

-- CreateIndex
CREATE INDEX "compatibility_scores_listingId_idx" ON "compatibility_scores"("listingId");

-- CreateIndex
CREATE INDEX "compatibility_scores_score_idx" ON "compatibility_scores"("score");

-- CreateIndex
CREATE UNIQUE INDEX "compatibility_scores_tenantId_listingId_key" ON "compatibility_scores"("tenantId", "listingId");

-- AddForeignKey
ALTER TABLE "compatibility_scores" ADD CONSTRAINT "compatibility_scores_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compatibility_scores" ADD CONSTRAINT "compatibility_scores_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

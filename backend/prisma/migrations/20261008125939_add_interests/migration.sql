-- CreateEnum
CREATE TYPE "InterestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

-- CreateTable
CREATE TABLE "interests" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "status" "InterestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "interests_tenantId_idx" ON "interests"("tenantId");

-- CreateIndex
CREATE INDEX "interests_listingId_idx" ON "interests"("listingId");

-- CreateIndex
CREATE INDEX "interests_status_idx" ON "interests"("status");

-- CreateIndex
CREATE UNIQUE INDEX "interests_tenantId_listingId_key" ON "interests"("tenantId", "listingId");

-- AddForeignKey
ALTER TABLE "interests" ADD CONSTRAINT "interests_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interests" ADD CONSTRAINT "interests_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "tenant_profiles" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "lifestyle" JSONB,
ADD COLUMN     "preferredFurnishing" "FurnishingType",
ADD COLUMN     "preferredRoomType" "RoomType";

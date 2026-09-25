/*
  Warnings:

  - Made the column `height` on table `Space` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "spaceElements" DROP CONSTRAINT "spaceElements_spaceId_fkey";

-- AlterTable
ALTER TABLE "Map" ADD COLUMN     "tmjUrl" TEXT;

-- Backfill legacy spaces created without a height
UPDATE "Space" SET "height" = "width" WHERE "height" IS NULL;

-- AlterTable
ALTER TABLE "Space" ADD COLUMN     "mapId" TEXT,
ALTER COLUMN "height" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Space" ADD CONSTRAINT "Space_mapId_fkey" FOREIGN KEY ("mapId") REFERENCES "Map"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spaceElements" ADD CONSTRAINT "spaceElements_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;
